import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is one level above /server
const ROOT_DIR = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const HOST = "127.0.0.1";
const PORT = 5179;
const AUTO_OPEN_DELAY_MS = 1800;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

let sseClients = new Set();
let lastBuildId = "";

/**
 * Broadcast a reload event to all connected browsers.
 */
function broadcastReload(buildId = String(Date.now())) {
  lastBuildId = buildId;

  for (const res of sseClients) {
    try {
      res.write(`event: build\ndata: ${buildId}\n\n`);
    } catch {
      // ignore
    }
  }
}

/**
 * Start build watcher (rebuild on changes).
 * Also triggers browser reload when rebuild succeeds.
 */
function startBuildWatch() {
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(cmd, ["run", "build:watch"], {
    cwd: ROOT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (buf) => {
    const line = buf.toString();
    process.stdout.write(line);

    if (line.includes("Build complete:")) {
      broadcastReload();
    }
  });

  child.stderr.on("data", (buf) => {
    process.stderr.write(buf.toString());
  });

  child.on("exit", (code) => {
    console.log(`build:watch exited with code ${code}`);
  });

  return child;
}

/**
 * Open the default browser (macOS/Windows/Linux).
 * @param {string} url
 */
function openBrowser(url) {
  const platform = process.platform;

  if (platform === "darwin") spawn("open", [url], { stdio: "ignore" });
  else if (platform === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  else spawn("xdg-open", [url], { stdio: "ignore" });
}

/**
 * Avoid opening a new tab when one is already connected.
 * @param {string} url
 */
function openBrowserIfNeeded(url) {
  setTimeout(() => {
    if (sseClients.size > 0) {
      console.log("Browser tab already connected. Skipping auto-open.");
      return;
    }

    openBrowser(url);
  }, AUTO_OPEN_DELAY_MS);
}

/**
 * Prevent path traversal and map URL to a file inside dist/.
 * @param {string} urlPath
 * @returns {string} absolute file path
 */
function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;

  const abs = path.join(DIST_DIR, requested);
  const normalized = path.normalize(abs);

  if (!normalized.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, "index.html");
  }

  return normalized;
}

/**
 * Inject a tiny reload script into index.html (SSE client).
 * Only injects for the served HTML, does not modify file on disk.
 * @param {string} html
 * @returns {string}
 */
function injectReloadScript(html) {
  const snippet = `
<script>
(() => {
  const storageKey = '__iconmoon_dev_build_id';
  const currentBuildId = ${JSON.stringify(lastBuildId)};

  const safeGet = () => {
    try {
      return sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  const safeSet = (value) => {
    try {
      sessionStorage.setItem(storageKey, value);
    } catch {
      // ignore
    }
  };

  if (currentBuildId) safeSet(currentBuildId);

  const applyReload = (nextBuildId) => {
    if (!nextBuildId) {
      window.location.reload();
      return;
    }

    if (safeGet() === nextBuildId) return;
    safeSet(nextBuildId);
    window.location.reload();
  };

  const es = new EventSource('/__reload');
  es.addEventListener('build', (event) => {
    applyReload(String(event.data || ''));
  });

  // Backward compatibility with old event name if needed.
  es.addEventListener('reload', (event) => {
    applyReload(String(event.data || ''));
  });
})();
</script>
`;

  // Inject before the last </body> to avoid matching literal strings inside JS bundles.
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf("</body>");
  if (idx !== -1) return `${html.slice(0, idx)}${snippet}\n${html.slice(idx)}`;
  return html + snippet;
}

/**
 * Create a local-only static server with SSE endpoint.
 */
function startServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    const method = req.method || "GET";

    // SSE endpoint
    if (url.startsWith("/__reload")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      res.write("retry: 1000\n\n");
      sseClients.add(res);
      if (lastBuildId) {
        res.write(`event: build\ndata: ${lastBuildId}\n\n`);
      }

      req.on("close", () => {
        sseClients.delete(res);
      });

      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Method Not Allowed");
    }

    const filePath = resolveFilePath(url);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not Found");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (method === "HEAD") {
      res.statusCode = 200;
      return res.end();
    }

    // Inject reload snippet only for index.html
    if (ext === ".html") {
      const html = fs.readFileSync(filePath, "utf8");
      res.statusCode = 200;
      return res.end(injectReloadScript(html));
    }

    const data = fs.readFileSync(filePath);
    res.statusCode = 200;
    res.end(data);
  });

  server.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.log(`Dev server running: ${url}`);
    openBrowserIfNeeded(url);
  });

  return server;
}

/* ------------ run ------------ */

startServer();
startBuildWatch();

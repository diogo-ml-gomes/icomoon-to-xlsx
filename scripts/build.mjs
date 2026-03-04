import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const args = new Set(process.argv.slice(2));
const isWatch = args.has("--watch");
const shouldMinify = args.has("--minify");

function nowLabel() {
  return new Date().toLocaleTimeString("pt-PT", { hour12: false });
}

/**
 * @param {number} bytes
 */
function prettySize(bytes) {
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

async function composeSingleHtml() {
  const [htmlTemplate, cssRaw] = await Promise.all([
    fsp.readFile(path.join(SRC_DIR, "index.html"), "utf8"),
    fsp.readFile(path.join(SRC_DIR, "styles.css"), "utf8"),
  ]);

  if (!htmlTemplate.includes("<!-- INLINE_CSS -->") || !htmlTemplate.includes("<!-- INLINE_JS -->")) {
    throw new Error("src/index.html precisa de <!-- INLINE_CSS --> e <!-- INLINE_JS -->.");
  }

  const [cssResult, jsBuildResult] = await Promise.all([
    esbuild.transform(cssRaw, {
      loader: "css",
      minify: shouldMinify,
      legalComments: "none",
    }),
    esbuild.build({
      entryPoints: [path.join(SRC_DIR, "app.js")],
      bundle: true,
      minify: shouldMinify,
      format: "iife",
      globalName: "IcoMoonExporter",
      platform: "browser",
      target: ["es2020"],
      write: false,
      logLevel: "silent",
    }),
  ]);

  const jsText = jsBuildResult.outputFiles?.[0]?.text;

  if (!jsText) {
    throw new Error("Falha a gerar JS bundle.");
  }

  const cssText = cssResult.code.trim();

  // Prevent accidental closing of inline tags by bundled content.
  const safeCssText = cssText.replace(/<\/style/gi, "<\\/style");
  const safeJsText = jsText.replace(/<\/script/gi, "<\\/script");

  if (shouldMinify) {
    return htmlTemplate
      .replace("<!-- INLINE_CSS -->", () => `<style>${safeCssText}</style>`)
      .replace("<!-- INLINE_JS -->", () => `<script>${safeJsText}</script>`);
  }

  return htmlTemplate
    .replace("<!-- INLINE_CSS -->", () => `<style>\n${safeCssText}\n</style>`)
    .replace("<!-- INLINE_JS -->", () => `<script>\n${safeJsText}\n</script>`);
}

async function runBuild() {
  const html = await composeSingleHtml();

  const gz = zlib.gzipSync(html, { level: 9 });
  const br = zlib.brotliCompressSync(html, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    },
  });

  await fsp.mkdir(DIST_DIR, { recursive: true });
  await Promise.all([
    fsp.writeFile(path.join(DIST_DIR, "index.html"), html, "utf8"),
    fsp.writeFile(path.join(DIST_DIR, "index.html.gz"), gz),
    fsp.writeFile(path.join(DIST_DIR, "index.html.br"), br),
    fsp.rm(path.join(DIST_DIR, "app.bundle.js"), { force: true }),
  ]);

  console.log(
    `[${nowLabel()}] Build complete: dist/index.html (${prettySize(Buffer.byteLength(html, "utf8"))}, gzip ${prettySize(gz.length)}, br ${prettySize(br.length)})`,
  );
}

async function main() {
  if (!isWatch) {
    await runBuild();
    return;
  }

  await runBuild();

  let isBuilding = false;
  let rebuildPending = false;
  let debounceTimer;

  const queueBuild = async () => {
    if (isBuilding) {
      rebuildPending = true;
      return;
    }

    isBuilding = true;

    try {
      await runBuild();
    } catch (err) {
      const msg = err instanceof Error ? err.stack || err.message : String(err);
      console.error(`[${nowLabel()}] Build failed\n${msg}`);
    } finally {
      isBuilding = false;
      if (rebuildPending) {
        rebuildPending = false;
        await queueBuild();
      }
    }
  };

  const watcher = fs.watch(SRC_DIR, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    if (!/\.(html|css|js)$/i.test(filename)) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[${nowLabel()}] Change detected: ${filename}`);
      void queueBuild();
    }, 80);
  });

  console.log(`[${nowLabel()}] Watching src/ for changes...`);

  process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[${nowLabel()}] Build failed\n${msg}`);
  process.exit(1);
});

/**
 * Normalize positive numeric dimensions.
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function normalizeDimension(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Normalize raw path list into SVG path defs.
 * @param {any} rawPaths
 * @param {any} rawAttrs
 * @returns {{ d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string }[]}
 */
function normalizePathDefs(rawPaths, rawAttrs) {
  const paths = Array.isArray(rawPaths)
    ? rawPaths
    : typeof rawPaths === "string" && rawPaths.trim()
      ? [rawPaths]
      : rawPaths && typeof rawPaths === "object"
        ? [rawPaths]
        : [];

  if (!paths.length) return [];

  const attrs = Array.isArray(rawAttrs)
    ? rawAttrs
    : rawAttrs && typeof rawAttrs === "object"
      ? [rawAttrs]
      : [];

  return paths
    .map((path, idx) => {
      const rawD = typeof path === "string"
        ? path
        : typeof path?.d === "string"
          ? path.d
          : typeof path?.path === "string"
            ? path.path
            : typeof path?._d === "string"
              ? path._d
              : "";
      const d = rawD.trim();
      if (!d) return null;

      const pathFill = typeof path?.fill === "string" && path.fill.trim()
        ? path.fill.trim()
        : typeof path?._fill === "string" && path._fill.trim()
          ? path._fill.trim()
          : undefined;

      const attrCandidate = attrs[idx] ?? attrs[0];
      const fill = typeof attrCandidate?.fill === "string" && attrCandidate.fill.trim()
        ? attrCandidate.fill.trim()
        : pathFill;

      const stroke = typeof attrCandidate?.stroke === "string" && attrCandidate.stroke.trim()
        ? attrCandidate.stroke.trim()
        : typeof path?.stroke === "string" && path.stroke.trim()
          ? path.stroke.trim()
          : undefined;

      const strokeWidth = attrCandidate?.["stroke-width"] != null
        ? String(attrCandidate["stroke-width"]).trim()
        : path?.["stroke-width"] != null
          ? String(path["stroke-width"]).trim()
          : undefined;

      const strokeLinecap = typeof attrCandidate?.["stroke-linecap"] === "string"
        ? attrCandidate["stroke-linecap"].trim()
        : undefined;

      const strokeLinejoin = typeof attrCandidate?.["stroke-linejoin"] === "string"
        ? attrCandidate["stroke-linejoin"].trim()
        : undefined;

      const transform = typeof attrCandidate?.transform === "string"
        ? attrCandidate.transform.trim()
        : undefined;

      return { d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, transform };
    })
    .filter(Boolean);
}

/**
 * Extract icon shape from raw SVG markup.
 * @param {string} svgMarkup
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFromSvgMarkup(svgMarkup) {
  if (typeof svgMarkup !== "string" || !svgMarkup.trim()) return null;

  try {
    const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    const rawViewBox = svg.getAttribute("viewBox");
    const width = normalizeDimension(svg.getAttribute("width"), 1024);
    const height = normalizeDimension(svg.getAttribute("height"), width);
    const viewBox = rawViewBox && rawViewBox.trim() ? rawViewBox.trim() : `0 0 ${width} ${height}`;

    const pathNodes = Array.from(svg.querySelectorAll("path"));
    const paths = pathNodes
      .map((node) => {
        const d = node.getAttribute("d");
        if (!d || !d.trim()) return null;

        const fill = node.getAttribute("fill");
        const stroke = node.getAttribute("stroke");
        const strokeWidth = node.getAttribute("stroke-width");
        const strokeLinecap = node.getAttribute("stroke-linecap");
        const strokeLinejoin = node.getAttribute("stroke-linejoin");
        const transform = node.getAttribute("transform");

        return {
          d: d.trim(),
          fill: fill && fill.trim() ? fill.trim() : undefined,
          stroke: stroke && stroke.trim() ? stroke.trim() : undefined,
          strokeWidth: strokeWidth && strokeWidth.trim() ? strokeWidth.trim() : undefined,
          strokeLinecap: strokeLinecap && strokeLinecap.trim() ? strokeLinecap.trim() : undefined,
          strokeLinejoin: strokeLinejoin && strokeLinejoin.trim() ? strokeLinejoin.trim() : undefined,
          transform: transform && transform.trim() ? transform.trim() : undefined,
        };
      })
      .filter(Boolean);

    if (!paths.length) return null;
    return { viewBox, paths };
  } catch {
    return null;
  }
}

/**
 * Build normalized icon shape from IcoMoon icon-like object.
 * @param {any} source
 * @param {{paths?: any, attrs?: any, width?: any, height?: any}} [fallback]
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFrom(source, fallback = {}) {
  if (!source || typeof source !== "object") return null;

  const paths = normalizePathDefs(source.paths ?? fallback.paths, source.attrs ?? fallback.attrs);
  if (!paths.length) return null;

  const width = normalizeDimension(source.width ?? fallback.width, 1024);
  const height = normalizeDimension(source.height ?? fallback.height, width);

  return {
    viewBox: `0 0 ${width} ${height}`,
    paths,
  };
}

/**
 * Return element payload for IcoMoon V2 AST node.
 * @param {any} node
 * @returns {{tagName?: string, attributes?: any, children?: any[]}|null}
 */
function getNodePayload(node) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.tagName === "string") return node;
  if (node.tag === "Element" && Array.isArray(node.args) && node.args[0] && typeof node.args[0] === "object") {
    return node.args[0];
  }
  return null;
}

/**
 * Convert V2 AST value node to text.
 * @param {any} valueNode
 * @returns {string|undefined}
 */
function nodeValueToString(valueNode) {
  if (!valueNode || typeof valueNode !== "object") return undefined;

  if (valueNode.tag === "StringValue" && typeof valueNode.args?.[0] === "string") {
    return valueNode.args[0];
  }

  if (valueNode.tag === "Value") {
    return nodeValueToString(valueNode.args?.[0]);
  }

  if (valueNode.tag === "Paint") {
    const paint = valueNode.args?.[0];
    if (paint?.tag === "CurrentColor") return "currentColor";
    if (paint?.tag === "NoPaint") return "none";
    return nodeValueToString(paint);
  }

  if (valueNode.tag === "Length") {
    const unit = valueNode.args?.[0];
    if (unit?.tag === "Px") {
      const amount = unit.args?.[0];
      return amount != null ? String(amount) : undefined;
    }
    return undefined;
  }

  if (valueNode.tag === "StrokeLineCap") {
    const cap = valueNode.args?.[0]?.tag;
    if (cap === "RoundCap") return "round";
    if (cap === "ButtCap") return "butt";
    if (cap === "SquareCap") return "square";
    return undefined;
  }

  if (valueNode.tag === "StrokeLineJoin") {
    const join = valueNode.args?.[0]?.tag;
    if (join === "RoundJoin") return "round";
    if (join === "MiterJoin") return "miter";
    if (join === "BevelJoin") return "bevel";
    return undefined;
  }

  if (valueNode.tag === "Transform") {
    const m = valueNode.args?.[0];
    if (!m || typeof m !== "object") return undefined;
    const values = [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => Number(v));
    if (values.some((v) => !Number.isFinite(v))) return undefined;
    return `matrix(${values.join(" ")})`;
  }

  return undefined;
}

/**
 * Convert V2 AST path data into SVG path string.
 * @param {any} dAttr
 * @returns {string|undefined}
 */
function nodePathToD(dAttr) {
  const value = dAttr?.tag === "Value" ? dAttr.args?.[0] : null;
  if (!value || value.tag !== "Paths" || !Array.isArray(value.args)) return undefined;

  const commands = [];

  value.args.forEach((group) => {
    if (!Array.isArray(group)) return;

    group.forEach((subPath) => {
      const start = subPath?.start;
      if (!Array.isArray(start) || start.length !== 2) return;

      commands.push(`M ${start[0]} ${start[1]}`);

      (subPath?.cmds || []).forEach((cmd) => {
        if (cmd?.tag === "LineTo") {
          const point = cmd?.args?.[0]?.point;
          if (Array.isArray(point) && point.length === 2) {
            commands.push(`L ${point[0]} ${point[1]}`);
          }
          return;
        }

        if (cmd?.tag === "BezierCurveTo") {
          const params = cmd?.args?.[0]?.args?.[0];
          const c1 = params?.c1;
          const c2 = params?.c2;
          const end = params?.end;
          if (
            Array.isArray(c1) && c1.length === 2 &&
            Array.isArray(c2) && c2.length === 2 &&
            Array.isArray(end) && end.length === 2
          ) {
            commands.push(`C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`);
          }
        }
      });

      if (subPath?.endings?.tag === "Connected") {
        commands.push("Z");
      }
    });
  });

  return commands.length ? commands.join(" ") : undefined;
}

/**
 * Extract icon shape from IcoMoon V2 node AST.
 * @param {any} node
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFromV2NodeAst(node) {
  const root = getNodePayload(node);
  if (!root || root.tagName !== "svg") return null;

  const attrs = root.attributes || {};
  const viewBoxData = attrs.viewBox?.args?.[0]?.args?.[0];
  const width = normalizeDimension(nodeValueToString(attrs.width), 1024);
  const height = normalizeDimension(nodeValueToString(attrs.height), width);
  const viewBox = viewBoxData && typeof viewBoxData === "object"
    ? `${viewBoxData.minX ?? 0} ${viewBoxData.minY ?? 0} ${viewBoxData.width ?? width} ${viewBoxData.height ?? height}`
    : `0 0 ${width} ${height}`;

  const paths = [];
  const stack = Array.isArray(root.children) ? [...root.children] : [];

  while (stack.length) {
    const child = stack.pop();
    const payload = getNodePayload(child);
    if (!payload) continue;

    if (payload.tagName === "path") {
      const d = nodePathToD(payload.attributes?.d);
      if (d) {
        paths.push({
          d,
          fill: nodeValueToString(payload.attributes?.fill),
          stroke: nodeValueToString(payload.attributes?.stroke),
          strokeWidth: nodeValueToString(payload.attributes?.["stroke-width"]),
          strokeLinecap: nodeValueToString(payload.attributes?.["stroke-linecap"]),
          strokeLinejoin: nodeValueToString(payload.attributes?.["stroke-linejoin"]),
          transform: nodeValueToString(payload.attributes?.transform),
        });
      }
    }

    if (Array.isArray(payload.children) && payload.children.length) {
      stack.push(...payload.children);
    }
  }

  if (!paths.length) return null;
  return { viewBox, paths };
}

/**
 * Extract icon shape from a V2 glyph candidate.
 * @param {any} glyph
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFromV2Glyph(glyph) {
  return (
    iconShapeFromV2NodeAst(glyph?.node) ||
    iconShapeFrom(glyph?.icon) ||
    iconShapeFrom(glyph?.svg, {
      paths: glyph?.svg?.paths ?? glyph?.svg?.path ?? glyph?.svg?.d,
      attrs: glyph?.svg?.attrs,
      width: glyph?.svg?.width,
      height: glyph?.svg?.height,
    }) ||
    iconShapeFromSvgMarkup(glyph?.svgText) ||
    iconShapeFromSvgMarkup(glyph?.svg?.content) ||
    iconShapeFromSvgMarkup(glyph?.svg?.raw) ||
    iconShapeFromSvgMarkup(glyph?.svg) ||
    iconShapeFrom(glyph, {
      paths: glyph?.paths ?? glyph?.path ?? glyph?.d ?? glyph?.svgPath ?? glyph?.svg,
      attrs: glyph?.attrs,
      width: glyph?.width,
      height: glyph?.height,
    })
  );
}

/**
 * Build icon map by icon name from parsed IcoMoon JSON.
 * @param {any} json
 * @param {"V1"|"V2"|null} format
 * @returns {Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>}
 */
export function buildIconMap(json, format) {
  const map = new Map();

  if (format === "V1" && Array.isArray(json?.icons)) {
    json.icons.forEach((entry) => {
      const name = entry?.properties?.name;
      if (!name || map.has(name)) return;

      const shape = iconShapeFrom(entry?.icon);
      if (shape) map.set(name, shape);
    });
    return map;
  }

  if (format === "V2" && Array.isArray(json?.glyphs)) {
    json.glyphs.forEach((glyph) => {
      const name = glyph?.extras?.name ?? glyph?.name ?? glyph?.css ?? glyph?.properties?.name;
      if (!name || map.has(name)) return;

      const shape = iconShapeFromV2Glyph(glyph);
      if (shape) map.set(name, shape);
    });
  }

  return map;
}

/**
 * Render icon shape into SVG DOM element.
 * @param {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}} shape
 * @returns {SVGSVGElement}
 */
export function createIconSvg(shape) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", shape.viewBox);
  svg.setAttribute("aria-hidden", "true");

  shape.paths.forEach((p) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    path.setAttribute("fill", p.fill || (p.stroke ? "none" : "currentColor"));
    if (p.stroke) path.setAttribute("stroke", p.stroke);
    if (p.strokeWidth) path.setAttribute("stroke-width", p.strokeWidth);
    if (p.strokeLinecap) path.setAttribute("stroke-linecap", p.strokeLinecap);
    if (p.strokeLinejoin) path.setAttribute("stroke-linejoin", p.strokeLinejoin);
    if (p.transform) path.setAttribute("transform", p.transform);
    svg.appendChild(path);
  });

  return svg;
}

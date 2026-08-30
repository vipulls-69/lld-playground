import type { UMLEdge, UMLNode } from "@/store/canvas-store";
import { nodeHeight, nodeWidth } from "./layout";

const PADDING = 32;

/** Bounding box of all nodes, padded. Returns null for an empty diagram. */
function diagramBounds(nodes: UMLNode[]) {
  if (!nodes.length) return null;
  const minX = Math.min(...nodes.map((n) => n.position.x)) - PADDING;
  const minY = Math.min(...nodes.map((n) => n.position.y)) - PADDING;
  const maxX = Math.max(...nodes.map((n) => n.position.x + nodeWidth(n))) + PADDING;
  const maxY = Math.max(...nodes.map((n) => n.position.y + nodeHeight(n))) + PADDING;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Properties that must not be copied from the live tree: they either re-apply
 * the pan/zoom we're trying to cancel, or hide content in the exported image.
 */
const ROOT_SKIPPED = new Set([
  "transform",
  "transform-origin",
  "translate",
  "rotate",
  "scale",
]);
const ALWAYS_SKIPPED = new Set(["will-change", "contain", "content-visibility"]);

/**
 * Copies computed styles from the live tree onto the clone. Exported SVG has no
 * access to the page stylesheet, so every visual property must be inlined.
 * `transform` is kept on descendants (node positions depend on it) but dropped
 * on the root, whose transform is the viewport pan/zoom we want to cancel.
 */
function inlineStyles(source: Element, target: Element) {
  const srcEls = [source, ...Array.from(source.querySelectorAll("*"))];
  const dstEls = [target, ...Array.from(target.querySelectorAll("*"))];
  for (let i = 0; i < srcEls.length; i++) {
    const computed = window.getComputedStyle(srcEls[i]);
    const el = dstEls[i] as HTMLElement;
    if (!el?.style) continue;
    const isRoot = i === 0;
    let css = "";
    for (const prop of computed) {
      if (ALWAYS_SKIPPED.has(prop)) continue;
      if (isRoot && ROOT_SKIPPED.has(prop)) continue;
      css += `${prop}:${computed.getPropertyValue(prop)};`;
    }
    el.setAttribute("style", css);
  }
}

/**
 * Clones the live React Flow viewport into a standalone SVG via `foreignObject`,
 * inlining computed styles so the result renders correctly outside the app.
 */
function buildSvg(nodes: UMLNode[], background: string): SVGSVGElement | null {
  const bounds = diagramBounds(nodes);
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!bounds || !viewport) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(bounds.width));
  svg.setAttribute("height", String(bounds.height));
  // Keep the viewBox at the origin and shift the content instead; a translated
  // viewBox combined with a translated wrapper cancelled itself out and pushed
  // the whole diagram off-canvas.
  svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(bounds.width));
  bg.setAttribute("height", String(bounds.height));
  bg.setAttribute("fill", background);
  svg.appendChild(bg);

  // Edge arrowheads live in a separate <svg><defs> outside the viewport, so they
  // have to be carried over or every marker reference resolves to nothing.
  document.querySelectorAll("svg defs").forEach((defs) => {
    if (defs.querySelector("marker")) svg.appendChild(defs.cloneNode(true));
  });

  const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
  fo.setAttribute("x", "0");
  fo.setAttribute("y", "0");
  fo.setAttribute("width", String(bounds.width));
  fo.setAttribute("height", String(bounds.height));

  const clone = viewport.cloneNode(true) as HTMLElement;
  inlineStyles(viewport, clone);
  // Applied after inlining, which would otherwise restore the live pan/zoom.
  clone.style.transform = `translate(${-bounds.x}px, ${-bounds.y}px)`;
  clone.style.transformOrigin = "0 0";
  clone.style.width = `${bounds.width}px`;
  clone.style.height = `${bounds.height}px`;
  // Drag handles and resize controls shouldn't appear in an export.
  clone
    .querySelectorAll(".react-flow__handle, .react-flow__resize-control")
    .forEach((el) => el.remove());
  // The edge layer is sized to the visible pane; let it spill so nothing clips.
  clone.querySelectorAll<SVGElement>(".react-flow__edges").forEach((el) => {
    el.style.overflow = "visible";
  });

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${bounds.width}px`;
  wrapper.style.height = `${bounds.height}px`;
  wrapper.appendChild(clone);
  fo.appendChild(wrapper);
  svg.appendChild(fo);
  return svg;
}

function serialize(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Encodes the markup as a base64 `data:` URI.
 *
 * A `blob:` URL taints the canvas it is drawn onto in several browsers, which
 * makes `toBlob`/`toDataURL` throw a SecurityError. A data URI is always
 * same-origin, so the resulting canvas stays exportable.
 */
function svgDataUri(markup: string): string {
  const bytes = new TextEncoder().encode(markup);
  let binary = "";
  // Chunked to avoid blowing the argument limit of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Removes anything that would taint the raster canvas.
 *
 * An SVG loaded as an image cannot fetch external resources, and referencing
 * them taints the canvas it is drawn onto. Any image or `url()` reference that
 * isn't already a data URI is therefore stripped.
 */
function stripExternalResources(svg: SVGSVGElement) {
  svg.querySelectorAll("image, img, use").forEach((el) => {
    const src = el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? el.getAttribute("src");
    if (src && !src.startsWith("data:")) el.remove();
  });
  svg.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const s = el.style;
    for (const prop of ["background-image", "mask-image", "-webkit-mask-image", "border-image-source"]) {
      const v = s.getPropertyValue(prop);
      if (v && v.includes("url(") && !v.includes("url(data:")) s.removeProperty(prop);
    }
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSvg(nodes: UMLNode[], _edges: UMLEdge[], background: string, filename = "diagram.svg") {
  const svg = buildSvg(nodes, background);
  if (!svg) return false;
  triggerDownload(new Blob([serialize(svg)], { type: "image/svg+xml;charset=utf-8" }), filename);
  return true;
}

/** Rasterizes the SVG through a canvas. `scale` controls the output DPI. */
export async function exportPng(
  nodes: UMLNode[],
  _edges: UMLEdge[],
  background: string,
  filename = "diagram.png",
  scale = 2
): Promise<boolean> {
  const svg = buildSvg(nodes, background);
  if (!svg) return false;
  stripExternalResources(svg);

  const width = Number(svg.getAttribute("width"));
  const height = Number(svg.getAttribute("height"));

  const img = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
  img.src = svgDataUri(serialize(svg));
  if (!(await loaded)) return false;

  // `decode()` guarantees the bitmap is ready; without it Chrome occasionally
  // rasterizes a blank frame for large diagrams.
  try {
    await img.decode();
  } catch {
    // Older browsers without decode(): onload above is enough.
  }

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let blob: Blob | null = null;
  try {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    // SecurityError: something in the diagram still tainted the canvas.
    return false;
  }
  if (!blob) return false;
  triggerDownload(blob, filename);
  return true;
}

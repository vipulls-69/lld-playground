import type { UMLEdge, UMLNode } from "@/store/canvas-store";

/** Fallback size used before React Flow has measured a node. */
const DEFAULT_W = 220;
const DEFAULT_H = 120;

/** Rough per-row height used when we have to estimate a node's size. */
const ROW_H = 22;
const HEADER_H = 38;
const SECTION_PAD = 10;

/** Smallest gap we'll ever leave between two nodes, so they never touch. */
const MIN_GAP = 24;

export type AlignAxis = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

/**
 * React Flow only populates `measured` once a node has been rendered, and it
 * goes stale while a node is being edited. Reading the live DOM box keeps the
 * layout honest; the data-derived estimate is the last resort.
 */
function domSize(id: string): { width: number; height: number } | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${CSS.escape(id)}"]`
  );
  if (!el) return null;
  const { offsetWidth, offsetHeight } = el;
  if (!offsetWidth || !offsetHeight) return null;
  return { width: offsetWidth, height: offsetHeight };
}

function estimatedHeight(n: UMLNode): number {
  const d = n.data;
  if (!d) return DEFAULT_H;
  if (d.kind === "note") return DEFAULT_H;
  const rows =
    (d.fields?.length ?? 0) + (d.methods?.length ?? 0) + (d.enumValues?.length ?? 0);
  const sections = [d.fields?.length, d.methods?.length, d.enumValues?.length].filter(
    (len) => (len ?? 0) > 0
  ).length;
  return HEADER_H + rows * ROW_H + sections * SECTION_PAD;
}

export function nodeWidth(n: UMLNode): number {
  return n.measured?.width ?? n.width ?? domSize(n.id)?.width ?? DEFAULT_W;
}

export function nodeHeight(n: UMLNode): number {
  // Prefer the live DOM box: UML nodes grow with their content, so a stale
  // `measured` value is the usual cause of overlapping rows after a tidy.
  return domSize(n.id)?.height ?? n.measured?.height ?? n.height ?? estimatedHeight(n);
}

/**
 * Aligns the given nodes along one edge (or center line) of their collective
 * bounding box. Returns only the nodes whose position changed.
 */
export function alignNodes(nodes: UMLNode[], axis: AlignAxis): Map<string, { x: number; y: number }> {
  const moves = new Map<string, { x: number; y: number }>();
  if (nodes.length < 2) return moves;

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const maxX = Math.max(...nodes.map((n) => n.position.x + nodeWidth(n)));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxY = Math.max(...nodes.map((n) => n.position.y + nodeHeight(n)));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  for (const n of nodes) {
    const { x, y } = n.position;
    let nx = x;
    let ny = y;
    switch (axis) {
      case "left":
        nx = minX;
        break;
      case "right":
        nx = maxX - nodeWidth(n);
        break;
      case "center-x":
        nx = midX - nodeWidth(n) / 2;
        break;
      case "top":
        ny = minY;
        break;
      case "bottom":
        ny = maxY - nodeHeight(n);
        break;
      case "center-y":
        ny = midY - nodeHeight(n) / 2;
        break;
    }
    if (nx !== x || ny !== y) moves.set(n.id, { x: nx, y: ny });
  }
  return moves;
}

/**
 * Spreads nodes so the gaps between them are equal. The two outermost nodes
 * stay put and everything between them is redistributed.
 */
export function distributeNodes(
  nodes: UMLNode[],
  axis: DistributeAxis
): Map<string, { x: number; y: number }> {
  const moves = new Map<string, { x: number; y: number }>();
  if (nodes.length < 3) return moves;

  const horizontal = axis === "horizontal";
  const size = (n: UMLNode) => (horizontal ? nodeWidth(n) : nodeHeight(n));
  const pos = (n: UMLNode) => (horizontal ? n.position.x : n.position.y);

  const sorted = [...nodes].sort((a, b) => pos(a) - pos(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const span = pos(last) + size(last) - pos(first);
  const totalSize = sorted.reduce((sum, n) => sum + size(n), 0);
  // If the nodes don't fit in their current span, grow outward from the first
  // one rather than packing them on top of each other.
  const gap = Math.max((span - totalSize) / (sorted.length - 1), MIN_GAP);

  let cursor = pos(first);
  for (const n of sorted) {
    const target = Math.round(cursor);
    if (target !== pos(n)) {
      moves.set(n.id, horizontal ? { x: target, y: n.position.y } : { x: n.position.x, y: target });
    }
    cursor += size(n) + gap;
  }
  return moves;
}

/** Edges that imply a parent -> child hierarchy, used to rank layout layers. */
const HIERARCHY_RELATIONS = new Set(["generalization", "realization"]);

const LAYER_GAP_Y = 120;
const NODE_GAP_X = 60;

/**
 * Layered auto-layout tuned for UML: supertypes sit above their subtypes, and
 * everything else is ranked by dependency depth. Roughly Sugiyama without the
 * crossing-minimisation phase, which keeps it dependency-free and fast.
 */
export function autoLayout(
  nodes: UMLNode[],
  edges: UMLEdge[]
): Map<string, { x: number; y: number }> {
  const moves = new Map<string, { x: number; y: number }>();
  if (!nodes.length) return moves;

  /** Final position per node, filled by the layered pass then de-overlapped. */
  const placed = new Map<string, { x: number; y: number }>();

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Build parent lists. For inheritance the *target* is the supertype, so it
  // must be ranked above the source; other relations flow source -> target.
  const parents = new Map<string, string[]>();
  for (const n of nodes) parents.set(n.id, []);
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    const inherit = HIERARCHY_RELATIONS.has(e.data?.relation ?? "");
    const [above, below] = inherit ? [e.target, e.source] : [e.source, e.target];
    if (above === below) continue;
    parents.get(below)!.push(above);
  }

  // Longest-path ranking with cycle protection.
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const rankOf = (id: string): number => {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle — break it here
    visiting.add(id);
    const ps = parents.get(id) ?? [];
    const r = ps.length ? Math.max(...ps.map(rankOf)) + 1 : 0;
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const n of nodes) rankOf(n.id);

  // Group into layers, preserving current left-to-right order for stability.
  const layers = new Map<number, UMLNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r)!.push(n);
  }
  for (const group of layers.values()) group.sort((a, b) => a.position.x - b.position.x);

  // Anchor the result at the existing top-left so the diagram doesn't jump.
  const originX = Math.min(...nodes.map((n) => n.position.x));
  const originY = Math.min(...nodes.map((n) => n.position.y));

  const sortedRanks = [...layers.keys()].sort((a, b) => a - b);
  const layerWidths = sortedRanks.map((r) => {
    const group = layers.get(r)!;
    return group.reduce((sum, n) => sum + nodeWidth(n), 0) + NODE_GAP_X * (group.length - 1);
  });
  const widest = Math.max(...layerWidths);

  let y = originY;
  sortedRanks.forEach((r, i) => {
    const group = layers.get(r)!;
    // Centre each layer against the widest one.
    let x = originX + (widest - layerWidths[i]) / 2;
    let tallest = 0;
    for (const n of group) {
      const target = { x: Math.round(x), y: Math.round(y) };
      placed.set(n.id, target);
      x += nodeWidth(n) + NODE_GAP_X;
      tallest = Math.max(tallest, nodeHeight(n));
    }
    y += tallest + LAYER_GAP_Y;
  });

  separateOverlaps(nodes, placed);

  for (const n of nodes) {
    const p = placed.get(n.id)!;
    if (p.x !== n.position.x || p.y !== n.position.y) moves.set(n.id, p);
  }

  return moves;
}

/**
 * Safety net for the layered pass: if two boxes still intersect (usually because
 * a node's rendered size differed from what we estimated), shove the later one
 * to the right until it clears. Mutates `placed` in place.
 */
function separateOverlaps(nodes: UMLNode[], placed: Map<string, { x: number; y: number }>) {
  const boxes = nodes
    .map((n) => ({ id: n.id, w: nodeWidth(n), h: nodeHeight(n), p: placed.get(n.id)! }))
    .filter((b) => b.p)
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x);

  for (let i = 0; i < boxes.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = boxes[j];
      const b = boxes[i];
      const overlapX = b.p.x < a.p.x + a.w + MIN_GAP && a.p.x < b.p.x + b.w + MIN_GAP;
      const overlapY = b.p.y < a.p.y + a.h + MIN_GAP && a.p.y < b.p.y + b.h + MIN_GAP;
      if (overlapX && overlapY) {
        b.p.x = Math.round(a.p.x + a.w + MIN_GAP);
        j = -1; // re-check against everything now that b moved
      }
    }
  }
}

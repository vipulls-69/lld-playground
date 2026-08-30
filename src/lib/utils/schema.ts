import type {
  EdgeRelationType,
  UMLEdgeData,
  UMLField,
  UMLMethod,
  UMLMethodParam,
  UMLNodeData,
  UMLNodeKind,
  Visibility,
} from "@/lib/types";
import type { Diagram, UMLEdge, UMLNode } from "@/store/canvas-store";
import { uid } from "@/lib/utils/cn";

/**
 * Bump when the persisted shape changes in a way that needs migrating.
 * `migrate()` is responsible for bringing older payloads up to date.
 */
export const WORKSPACE_VERSION = 1;

export interface WorkspaceFile {
  version: number;
  diagrams: Diagram[];
  currentDiagramId?: string;
}

const NODE_KINDS: UMLNodeKind[] = [
  "class",
  "abstract",
  "interface",
  "enum",
  "record",
  "actor",
  "lifeline",
  "state",
  "package",
  "note",
];

const VISIBILITIES: Visibility[] = ["public", "private", "protected", "package"];

const RELATIONS: EdgeRelationType[] = [
  "association",
  "aggregation",
  "composition",
  "generalization",
  "realization",
  "dependency",
];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const oneOf = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
  typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fallback;

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function parseParam(raw: unknown): UMLMethodParam | null {
  if (!isObject(raw)) return null;
  return { name: str(raw.name, "arg"), type: str(raw.type, "any") };
}

function parseField(raw: unknown): UMLField | null {
  if (!isObject(raw)) return null;
  const name = str(raw.name);
  if (!name) return null;
  const field: UMLField = {
    id: str(raw.id) || uid("f"),
    visibility: oneOf(raw.visibility, VISIBILITIES, "private"),
    name,
    type: str(raw.type, "any"),
  };
  if (typeof raw.defaultValue === "string") field.defaultValue = raw.defaultValue;
  if (typeof raw.isStatic === "boolean") field.isStatic = raw.isStatic;
  return field;
}

function parseMethod(raw: unknown): UMLMethod | null {
  if (!isObject(raw)) return null;
  const name = str(raw.name);
  if (!name) return null;
  const method: UMLMethod = {
    id: str(raw.id) || uid("m"),
    visibility: oneOf(raw.visibility, VISIBILITIES, "public"),
    name,
    params: arr(raw.params)
      .map(parseParam)
      .filter((p): p is UMLMethodParam => p !== null),
    returnType: str(raw.returnType, "void"),
  };
  if (typeof raw.isStatic === "boolean") method.isStatic = raw.isStatic;
  if (typeof raw.isAbstract === "boolean") method.isAbstract = raw.isAbstract;
  return method;
}

function parseNodeData(raw: unknown): UMLNodeData {
  const src = isObject(raw) ? raw : {};
  const data: UMLNodeData = {
    kind: oneOf(src.kind, NODE_KINDS, "class"),
    name: str(src.name, "Unnamed"),
    fields: arr(src.fields)
      .map(parseField)
      .filter((f): f is UMLField => f !== null),
    methods: arr(src.methods)
      .map(parseMethod)
      .filter((m): m is UMLMethod => m !== null),
  };
  if (typeof src.stereotype === "string") data.stereotype = src.stereotype;
  if (typeof src.color === "string") data.color = src.color;
  if (Array.isArray(src.enumValues)) {
    data.enumValues = src.enumValues.filter((v): v is string => typeof v === "string");
  }
  return data;
}

function parseNode(raw: unknown): UMLNode | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const pos = isObject(raw.position) ? raw.position : {};
  const node: UMLNode = {
    id,
    type: str(raw.type, "uml"),
    position: { x: num(pos.x), y: num(pos.y) },
    data: parseNodeData(raw.data),
  };
  if (typeof raw.width === "number") node.width = raw.width;
  if (typeof raw.height === "number") node.height = raw.height;
  return node;
}

function parseEdgeData(raw: unknown): UMLEdgeData {
  const src = isObject(raw) ? raw : {};
  const data: UMLEdgeData = { relation: oneOf(src.relation, RELATIONS, "association") };
  for (const key of [
    "sourceLabel",
    "targetLabel",
    "sourceMultiplicity",
    "targetMultiplicity",
  ] as const) {
    if (typeof src[key] === "string") data[key] = src[key] as string;
  }
  return data;
}

function parseEdge(raw: unknown, nodeIds: Set<string>): UMLEdge | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const source = str(raw.source);
  const target = str(raw.target);
  // Drop dangling edges — they crash the renderer.
  if (!id || !nodeIds.has(source) || !nodeIds.has(target)) return null;
  const edge: UMLEdge = {
    id,
    source,
    target,
    type: str(raw.type, "uml"),
    data: parseEdgeData(raw.data),
  };
  if (typeof raw.sourceHandle === "string") edge.sourceHandle = raw.sourceHandle;
  if (typeof raw.targetHandle === "string") edge.targetHandle = raw.targetHandle;
  return edge;
}

/** Validates a `{ nodes, edges }` pair, dropping anything malformed. */
export function parseGraph(raw: unknown): { nodes: UMLNode[]; edges: UMLEdge[] } {
  const src = isObject(raw) ? raw : {};
  const nodes = arr(src.nodes)
    .map(parseNode)
    .filter((n): n is UMLNode => n !== null);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = arr(src.edges)
    .map((e) => parseEdge(e, nodeIds))
    .filter((e): e is UMLEdge => e !== null);
  return { nodes, edges };
}

function parseDiagram(raw: unknown): Diagram | null {
  if (!isObject(raw)) return null;
  const now = new Date().toISOString();
  const { nodes, edges } = parseGraph(raw);
  return {
    id: str(raw.id) || uid("D"),
    name: str(raw.name, "Untitled"),
    nodes,
    edges,
    createdAt: str(raw.createdAt, now),
    updatedAt: str(raw.updatedAt, now),
  };
}

/** Upgrades older payloads to the current shape. */
function migrate(raw: unknown): unknown {
  // Legacy: a bare array of diagrams, or a bare `{ nodes, edges }` workspace.
  if (Array.isArray(raw)) return { version: WORKSPACE_VERSION, diagrams: raw };
  if (isObject(raw) && !("diagrams" in raw) && ("nodes" in raw || "edges" in raw)) {
    const now = new Date().toISOString();
    return {
      version: WORKSPACE_VERSION,
      diagrams: [{ ...raw, id: uid("D"), name: "Default", createdAt: now, updatedAt: now }],
    };
  }
  return raw;
}

/**
 * Parses an untrusted workspace payload (localStorage or an imported file).
 * Returns `null` only when nothing salvageable is present.
 */
export function parseWorkspace(raw: unknown): WorkspaceFile | null {
  const migrated = migrate(raw);
  if (!isObject(migrated)) return null;
  const diagrams = arr(migrated.diagrams)
    .map(parseDiagram)
    .filter((d): d is Diagram => d !== null);
  if (!diagrams.length) return null;
  const requested = str(migrated.currentDiagramId);
  return {
    version: WORKSPACE_VERSION,
    diagrams,
    currentDiagramId: diagrams.some((d) => d.id === requested) ? requested : diagrams[0].id,
  };
}

/** Parses a JSON string, tolerating corruption. */
export function parseWorkspaceJson(text: string): WorkspaceFile | null {
  try {
    return parseWorkspace(JSON.parse(text));
  } catch {
    return null;
  }
}

export function serializeWorkspace(
  diagrams: Diagram[],
  currentDiagramId?: string
): string {
  return JSON.stringify({ version: WORKSPACE_VERSION, diagrams, currentDiagramId });
}

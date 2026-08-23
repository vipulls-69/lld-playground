import type { UMLEdge, UMLNode } from "@/store/canvas-store";
import type { UMLField, UMLMethod } from "@/lib/types";
import { symbolToVisibility, uid, visibilitySymbol } from "@/lib/utils/cn";

const RELATION_SYNTAX: Record<string, string> = {
  inheritance: "<|--",
  generalization: "<|--",
  realization: "<|..",
  composition: "*--",
  aggregation: "o--",
  association: "-->",
  dependency: "..>",
};

const SYNTAX_TO_RELATION: Record<string, string> = {
  "<|--": "generalization",
  "<|..": "realization",
  "*--": "composition",
  "o--": "aggregation",
  "-->": "association",
  "..>": "dependency",
  "--": "association",
};

export function diagramToMermaid(nodes: UMLNode[], edges: UMLEdge[]): string {
  const lines: string[] = ["classDiagram"];
  const classNodes = nodes.filter((n) =>
    ["class", "abstract", "interface", "enum", "record"].includes(n.data.kind)
  );
  const idToName = new Map(classNodes.map((n) => [n.id, n.data.name]));

  for (const node of classNodes) {
    const d = node.data;
    const safeName = d.name.replace(/\s+/g, "_");
    if (d.kind === "interface") lines.push(`  class ${safeName} {`);
    else lines.push(`  class ${safeName} {`);

    if (d.stereotype) lines.push(`    <<${d.stereotype}>>`);
    else if (d.kind === "interface") lines.push(`    <<interface>>`);
    else if (d.kind === "abstract") lines.push(`    <<abstract>>`);
    else if (d.kind === "enum") lines.push(`    <<enumeration>>`);
    else if (d.kind === "record") lines.push(`    <<record>>`);

    if (d.kind === "enum" && d.enumValues) {
      for (const v of d.enumValues) lines.push(`    ${v}`);
    }
    for (const f of d.fields) {
      const staticMod = f.isStatic ? "$" : "";
      lines.push(`    ${visibilitySymbol(f.visibility)}${f.name}: ${f.type}${staticMod}`);
    }
    for (const m of d.methods) {
      const params = m.params.map((p) => `${p.name}: ${p.type}`).join(", ");
      const abstractMod = m.isAbstract ? "*" : m.isStatic ? "$" : "";
      lines.push(`    ${visibilitySymbol(m.visibility)}${m.name}(${params}): ${m.returnType}${abstractMod}`);
    }
    lines.push(`  }`);
  }

  for (const edge of edges) {
    const src = idToName.get(edge.source);
    const tgt = idToName.get(edge.target);
    if (!src || !tgt) continue;
    const rel = RELATION_SYNTAX[edge.data?.relation ?? "association"] ?? "-->";
    const srcMult = edge.data?.sourceMultiplicity ? `"${edge.data.sourceMultiplicity}" ` : "";
    const tgtMult = edge.data?.targetMultiplicity ? ` "${edge.data.targetMultiplicity}"` : "";
    const label = edge.data?.sourceLabel ? ` : ${edge.data.sourceLabel}` : "";
    lines.push(`  ${src.replace(/\s+/g, "_")} ${srcMult}${rel}${tgtMult} ${tgt.replace(/\s+/g, "_")}${label}`);
  }

  return lines.join("\n");
}

export function mermaidToDiagram(code: string): { nodes: UMLNode[]; edges: UMLEdge[] } {
  const nodes: UMLNode[] = [];
  const edges: UMLEdge[] = [];
  const nameToId = new Map<string, string>();
  const lines = code.split("\n").map((l) => l.trimEnd());

  let current: UMLNode | null = null;
  const x = 60;
  let y = 60;
  const colWidth = 280;
  const rowHeight = 260;
  let col = 0;

  const ensureNode = (name: string): UMLNode => {
    const key = name.replace(/\s+/g, "_");
    if (nameToId.has(key)) {
      return nodes.find((n) => n.id === nameToId.get(key))!;
    }
    const id = uid("n");
    const node: UMLNode = {
      id,
      type: "uml",
      position: { x: x + col * colWidth, y },
      data: { kind: "class", name: key, fields: [], methods: [] },
    };
    col += 1;
    if (col > 3) {
      col = 0;
      y += rowHeight;
    }
    nodes.push(node);
    nameToId.set(key, id);
    return node;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "classDiagram" || line.startsWith("%%")) continue;

    const classMatch = line.match(/^class\s+(\w+)\s*\{?$/);
    if (classMatch) {
      current = ensureNode(classMatch[1]);
      if (line.endsWith("{")) continue;
      continue;
    }
    if (line === "}") {
      current = null;
      continue;
    }

    const stereoMatch = line.match(/^<<(.+)>>$/);
    if (stereoMatch && current) {
      const s = stereoMatch[1].toLowerCase();
      current.data.stereotype = s;
      if (s === "interface") current.data.kind = "interface";
      else if (s === "abstract") current.data.kind = "abstract";
      else if (s === "enumeration" || s === "enum") current.data.kind = "enum";
      else if (s === "record") current.data.kind = "record";
      continue;
    }

    // Relationship line
    const relMatch = line.match(
      /^(\w+)\s*(?:"([^"]*)")?\s*(<\|--|<\|\.\.|\*--|o--|-->|\.\.>|--)\s*(?:"([^"]*)")?\s*(\w+)(?:\s*:\s*(.+))?$/
    );
    if (relMatch) {
      const [, src, srcMult, syntax, tgtMult, tgt, label] = relMatch;
      const srcNode = ensureNode(src);
      const tgtNode = ensureNode(tgt);
      edges.push({
        id: uid("e"),
        source: srcNode.id,
        target: tgtNode.id,
        type: "uml",
        data: {
          relation: (SYNTAX_TO_RELATION[syntax] ?? "association") as import("@/lib/types").EdgeRelationType,
          sourceMultiplicity: srcMult,
          targetMultiplicity: tgtMult,
          sourceLabel: label,
        },
      });
      continue;
    }

    if (current) {
      // Method: +name(param: type): ret
      const methodMatch = line.match(/^([+\-#~])(\w+)\(([^)]*)\)\s*:?\s*([\w<>\[\]]*)?([*]$)?(\$)?$/);
      if (methodMatch) {
        const [, vis, name, paramsRaw, ret = "void", abstractMod, staticMod] = methodMatch;
        const params = paramsRaw
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const [pn, pt] = p.split(":").map((s) => s.trim());
            return { name: pn ?? "arg", type: pt ?? "any" };
          });
        const method: UMLMethod = {
          id: uid("m"),
          visibility: symbolToVisibility(vis),
          name,
          params,
          returnType: ret || "void",
          isAbstract: Boolean(abstractMod),
          isStatic: Boolean(staticMod),
        };
        current.data.methods.push(method);
        continue;
      }

      // Field: +name: type
      const fieldMatch = line.match(/^([+\-#~])(\w+)\s*:\s*([\w<>\[\]]+)(\$)?$/);
      if (fieldMatch) {
        const [, vis, name, type, staticMod] = fieldMatch;
        const field: UMLField = {
          id: uid("f"),
          visibility: symbolToVisibility(vis),
          name,
          type,
          isStatic: Boolean(staticMod),
        };
        current.data.fields.push(field);
        continue;
      }

      // Enum value (bare word inside enum)
      if (current.data.kind === "enum" && /^\w+$/.test(line)) {
        current.data.enumValues = [...(current.data.enumValues ?? []), line];
        continue;
      }
    }
  }

  return { nodes, edges };
}

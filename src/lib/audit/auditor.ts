import type { AuditFinding } from "@/lib/types";
import type { UMLEdge, UMLNode } from "@/store/canvas-store";
import { uid } from "@/lib/utils/cn";

const SRP_FIELD_THRESHOLD = 7;
const SRP_METHOD_THRESHOLD = 10;
const GOD_FANOUT_THRESHOLD = 5;

export function auditDiagram(nodes: UMLNode[], edges: UMLEdge[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const classNodes = nodes.filter((n) =>
    ["class", "abstract", "interface", "enum", "record"].includes(n.data.kind)
  );

  for (const node of classNodes) {
    const d = node.data;

    // SRP: too many members
    if (d.fields.length > SRP_FIELD_THRESHOLD || d.methods.length > SRP_METHOD_THRESHOLD) {
      findings.push({
        id: uid("a"),
        severity: "warning",
        principle: "SRP",
        message: `${d.name} has ${d.fields.length} fields and ${d.methods.length} methods. Consider splitting responsibilities.`,
        nodeId: node.id,
      });
    }

    // Naming: class should be PascalCase
    if (!/^[A-Z][A-Za-z0-9]*$/.test(d.name) && d.kind !== "lifeline") {
      findings.push({
        id: uid("a"),
        severity: "info",
        principle: "Convention",
        message: `${d.name} is not PascalCase.`,
        nodeId: node.id,
      });
    }

    // Interface naming
    if (d.kind === "interface" && !/^I[A-Z]/.test(d.name) && !/able$/.test(d.name)) {
      findings.push({
        id: uid("a"),
        severity: "info",
        principle: "Convention",
        message: `Interface ${d.name} — consider an "I" prefix or "-able" suffix.`,
        nodeId: node.id,
      });
    }

    // Abstract class with no abstract methods
    if (d.kind === "abstract" && !d.methods.some((m) => m.isAbstract)) {
      findings.push({
        id: uid("a"),
        severity: "info",
        principle: "Design",
        message: `Abstract class ${d.name} declares no abstract methods.`,
        nodeId: node.id,
      });
    }

    // God object: high fan-out
    const fanOut = edges.filter((e) => e.source === node.id).length;
    if (fanOut > GOD_FANOUT_THRESHOLD) {
      findings.push({
        id: uid("a"),
        severity: "warning",
        principle: "Coupling",
        message: `${d.name} depends on ${fanOut} other types (high fan-out). Possible god object.`,
        nodeId: node.id,
      });
    }

    // Public fields violate encapsulation
    const publicFields = d.fields.filter((f) => f.visibility === "public");
    if (publicFields.length > 0 && d.kind === "class") {
      findings.push({
        id: uid("a"),
        severity: "warning",
        principle: "Encapsulation",
        message: `${d.name} exposes ${publicFields.length} public field(s): ${publicFields.map((f) => f.name).join(", ")}. Prefer accessors.`,
        nodeId: node.id,
      });
    }
  }

  // OCP / Strategy hint: concrete class with switch-like method names
  for (const node of classNodes) {
    const d = node.data;
    const hasBranchy = d.methods.some((m) => /calculate|process|handle|execute/i.test(m.name));
    const realizesSomething = edges.some((e) => e.source === node.id && e.data?.relation === "realization");
    if (hasBranchy && !realizesSomething && d.kind === "class") {
      const m = d.methods.find((mm) => /calculate|process|handle|execute/i.test(mm.name));
      findings.push({
        id: uid("a"),
        severity: "info",
        principle: "OCP",
        message: `${d.name}.${m?.name}() may vary by type. If it branches on kind, extract a Strategy interface.`,
        nodeId: node.id,
      });
    }
  }

  // LSP: deep inheritance chains
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const parent = edges.find((e) => e.source === id && e.data?.relation === "generalization");
    return parent ? 1 + depthOf(parent.target, seen) : 0;
  };
  for (const node of classNodes) {
    const depth = depthOf(node.id);
    if (depth >= 3) {
      findings.push({
        id: uid("a"),
        severity: "warning",
        principle: "LSP / Composition",
        message: `${node.data.name} sits at inheritance depth ${depth}. Prefer composition over deep hierarchies.`,
        nodeId: node.id,
      });
    }
  }

  // ISP: fat interfaces
  for (const node of classNodes) {
    if (node.data.kind === "interface" && node.data.methods.length > 5) {
      findings.push({
        id: uid("a"),
        severity: "warning",
        principle: "ISP",
        message: `Interface ${node.data.name} has ${node.data.methods.length} methods. Consider segregating into smaller contracts.`,
        nodeId: node.id,
      });
    }
  }

  // DIP: concrete-to-concrete dependencies
  for (const edge of edges) {
    if (edge.data?.relation !== "dependency" && edge.data?.relation !== "association") continue;
    const src = classNodes.find((n) => n.id === edge.source);
    const tgt = classNodes.find((n) => n.id === edge.target);
    if (src && tgt && tgt.data.kind === "class" && src.data.kind === "class") {
      const tgtIsLowLevel = /Repository|Dao|Client|Driver|Gateway|Impl$/i.test(tgt.data.name);
      if (tgtIsLowLevel) {
        findings.push({
          id: uid("a"),
          severity: "warning",
          principle: "DIP",
          message: `${src.data.name} depends directly on concrete ${tgt.data.name}. Depend on an abstraction instead.`,
          nodeId: src.id,
        });
      }
    }
  }

  // Empty diagram
  if (classNodes.length === 0) {
    findings.push({
      id: uid("a"),
      severity: "info",
      principle: "General",
      message: "Canvas has no class elements. Drag shapes from the library to begin.",
    });
  }

  return findings;
}

import type { CodeLanguage, UMLField, UMLMethod } from "@/lib/types";
import type { UMLEdge, UMLNode } from "@/store/canvas-store";

const TYPE_MAP: Record<CodeLanguage, Record<string, string>> = {
  java: { String: "String", number: "double", boolean: "boolean", void: "void", any: "Object", string: "String" },
  cpp: { String: "std::string", string: "std::string", number: "double", boolean: "bool", void: "void", any: "auto" },
  typescript: { String: "string", number: "number", boolean: "boolean", void: "void", any: "any", string: "string" },
  python: { String: "str", string: "str", number: "float", boolean: "bool", void: "None", any: "Any" },
  go: { String: "string", string: "string", number: "float64", boolean: "bool", void: "", any: "interface{}" },
};

function mapType(type: string, lang: CodeLanguage): string {
  const mapped = TYPE_MAP[lang][type];
  if (mapped !== undefined) return mapped;
  return type;
}

function javaVis(v: string): string {
  return v === "package" ? "" : `${v} `;
}

function genJava(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string {
  const d = node.data;
  const lines: string[] = [];
  const parents = inheritanceOf(node, edges, nodes);
  const ifaces = realizationsOf(node, edges, nodes);

  if (d.kind === "interface") {
    lines.push(`public interface ${d.name} {`);
    for (const m of d.methods) {
      lines.push(`    ${mapType(m.returnType, "java")} ${m.name}(${javaParams(m)});`);
    }
    lines.push(`}`);
    return lines.join("\n");
  }
  if (d.kind === "enum") {
    lines.push(`public enum ${d.name} {`);
    lines.push(`    ${(d.enumValues ?? []).join(", ")}`);
    lines.push(`}`);
    return lines.join("\n");
  }

  const abstractMod = d.kind === "abstract" ? "abstract " : "";
  const extendsPart = parents.length ? ` extends ${parents[0]}` : "";
  const implPart = ifaces.length ? ` implements ${ifaces.join(", ")}` : "";
  lines.push(`public ${abstractMod}class ${d.name}${extendsPart}${implPart} {`);
  for (const f of d.fields) {
    const staticMod = f.isStatic ? "static " : "";
    const def = f.defaultValue ? ` = ${f.defaultValue}` : "";
    lines.push(`    ${javaVis(f.visibility)}${staticMod}${mapType(f.type, "java")} ${f.name}${def};`);
  }
  if (d.fields.length && d.methods.length) lines.push("");
  for (const m of d.methods) {
    const staticMod = m.isStatic ? "static " : "";
    const abstractMethod = m.isAbstract || d.kind === "abstract" && m.isAbstract;
    const absMod = m.isAbstract ? "abstract " : "";
    const body = m.isAbstract ? ";" : ` {\n        // TODO: implement\n    }`;
    lines.push(
      `    ${javaVis(m.visibility)}${absMod}${staticMod}${mapType(m.returnType, "java")} ${m.name}(${javaParams(m)})${body}`
    );
    void abstractMethod;
  }
  lines.push(`}`);
  return lines.join("\n");
}

function javaParams(m: UMLMethod): string {
  return m.params.map((p) => `${mapType(p.type, "java")} ${p.name}`).join(", ");
}

function genCpp(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string {
  const d = node.data;
  const lines: string[] = [];
  const parents = [...inheritanceOf(node, edges, nodes), ...realizationsOf(node, edges, nodes)];

  if (d.kind === "enum") {
    lines.push(`enum class ${d.name} {`);
    lines.push(`    ${(d.enumValues ?? []).join(",\n    ")}`);
    lines.push(`};`);
    return lines.join("\n");
  }

  const inherit = parents.length ? ` : ${parents.map((p) => `public ${p}`).join(", ")}` : "";
  lines.push(`class ${d.name}${inherit} {`);

  const groups: Record<string, { fields: UMLField[]; methods: UMLMethod[] }> = {
    public: { fields: [], methods: [] },
    protected: { fields: [], methods: [] },
    private: { fields: [], methods: [] },
  };
  for (const f of d.fields) (groups[f.visibility] ?? groups.private).fields.push(f);
  for (const m of d.methods) (groups[m.visibility] ?? groups.private).methods.push(m);

  for (const vis of ["public", "protected", "private"] as const) {
    const g = groups[vis];
    if (!g.fields.length && !g.methods.length) continue;
    lines.push(`${vis}:`);
    for (const f of g.fields) {
      const staticMod = f.isStatic ? "static " : "";
      lines.push(`    ${staticMod}${mapType(f.type, "cpp")} ${f.name};`);
    }
    for (const m of g.methods) {
      const staticMod = m.isStatic ? "static " : "";
      const virt = m.isAbstract ? "virtual " : "";
      const pure = m.isAbstract ? " = 0" : ";";
      const params = m.params.map((p) => `${mapType(p.type, "cpp")} ${p.name}`).join(", ");
      lines.push(`    ${virt}${staticMod}${mapType(m.returnType, "cpp")} ${m.name}(${params})${pure}`);
    }
  }
  lines.push(`};`);
  return lines.join("\n");
}

function genTypeScript(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string {
  const d = node.data;
  const lines: string[] = [];
  const parents = inheritanceOf(node, edges, nodes);
  const ifaces = realizationsOf(node, edges, nodes);

  if (d.kind === "interface") {
    lines.push(`export interface ${d.name} {`);
    for (const m of d.methods) {
      const params = m.params.map((p) => `${p.name}: ${mapType(p.type, "typescript")}`).join(", ");
      lines.push(`  ${m.name}(${params}): ${mapType(m.returnType, "typescript")};`);
    }
    for (const f of d.fields) {
      lines.push(`  ${f.name}: ${mapType(f.type, "typescript")};`);
    }
    lines.push(`}`);
    return lines.join("\n");
  }
  if (d.kind === "enum") {
    lines.push(`export enum ${d.name} {`);
    lines.push((d.enumValues ?? []).map((v) => `  ${v} = "${v}",`).join("\n"));
    lines.push(`}`);
    return lines.join("\n");
  }

  const abstractMod = d.kind === "abstract" ? "abstract " : "";
  const extendsPart = parents.length ? ` extends ${parents[0]}` : "";
  const implPart = ifaces.length ? ` implements ${ifaces.join(", ")}` : "";
  lines.push(`export ${abstractMod}class ${d.name}${extendsPart}${implPart} {`);
  for (const f of d.fields) {
    const vis = f.visibility === "package" ? "" : `${f.visibility} `;
    const staticMod = f.isStatic ? "static " : "";
    const def = f.defaultValue ? ` = ${f.defaultValue}` : "";
    lines.push(`  ${vis}${staticMod}${f.name}: ${mapType(f.type, "typescript")}${def};`);
  }
  for (const m of d.methods) {
    const vis = m.visibility === "package" ? "" : `${m.visibility} `;
    const staticMod = m.isStatic ? "static " : "";
    const absMod = m.isAbstract ? "abstract " : "";
    const params = m.params.map((p) => `${p.name}: ${mapType(p.type, "typescript")}`).join(", ");
    const body = m.isAbstract ? ";" : ` {\n    throw new Error("Not implemented");\n  }`;
    lines.push(`  ${vis}${absMod}${staticMod}${m.name}(${params}): ${mapType(m.returnType, "typescript")}${body}`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

function genPython(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string {
  const d = node.data;
  const lines: string[] = [];
  const parents = [...inheritanceOf(node, edges, nodes), ...realizationsOf(node, edges, nodes)];

  if (d.kind === "enum") {
    lines.push(`class ${d.name}(Enum):`);
    if (d.enumValues?.length) {
      d.enumValues.forEach((v, i) => lines.push(`    ${v} = ${i + 1}`));
    } else {
      lines.push(`    pass`);
    }
    return lines.join("\n");
  }

  const bases = parents.length ? `(${parents.join(", ")})` : d.kind === "abstract" ? "(ABC)" : "";
  lines.push(`class ${d.name}${bases}:`);

  const staticFields = d.fields.filter((f) => f.isStatic);
  const instFields = d.fields.filter((f) => !f.isStatic);
  for (const f of staticFields) {
    lines.push(`    ${f.name}: ${mapType(f.type, "python")} = ${f.defaultValue ?? "None"}`);
  }

  if (instFields.length) {
    const params = instFields.map((f) => `${f.name}: ${mapType(f.type, "python")}`).join(", ");
    lines.push(`    def __init__(self, ${params}):`);
    for (const f of instFields) lines.push(`        self.${f.name} = ${f.name}`);
  }

  for (const m of d.methods) {
    if (m.isAbstract) lines.push(`    @abstractmethod`);
    if (m.isStatic) lines.push(`    @staticmethod`);
    const params = [m.isStatic ? null : "self", ...m.params.map((p) => `${p.name}: ${mapType(p.type, "python")}`)]
      .filter(Boolean)
      .join(", ");
    const ret = mapType(m.returnType, "python");
    lines.push(`    def ${m.name}(${params}) -> ${ret || "None"}:`);
    lines.push(`        raise NotImplementedError`);
    lines.push("");
  }

  if (!d.fields.length && !d.methods.length) lines.push(`    pass`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function genGo(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string {
  const d = node.data;
  const lines: string[] = [];
  void edges;
  void nodes;

  if (d.kind === "interface") {
    lines.push(`type ${d.name} interface {`);
    for (const m of d.methods) {
      const params = m.params.map((p) => `${p.name} ${mapType(p.type, "go")}`).join(", ");
      const ret = mapType(m.returnType, "go");
      lines.push(`\t${capitalize(m.name)}(${params})${ret ? " " + ret : ""}`);
    }
    lines.push(`}`);
    return lines.join("\n");
  }
  if (d.kind === "enum") {
    lines.push(`type ${d.name} int`);
    lines.push("");
    lines.push("const (");
    (d.enumValues ?? []).forEach((v, i) => {
      lines.push(i === 0 ? `\t${v} ${d.name} = iota` : `\t${v}`);
    });
    lines.push(")");
    return lines.join("\n");
  }

  lines.push(`type ${d.name} struct {`);
  for (const f of d.fields) {
    const name = f.visibility === "public" ? capitalize(f.name) : f.name;
    lines.push(`\t${name} ${mapType(f.type, "go")}`);
  }
  lines.push(`}`);
  for (const m of d.methods) {
    const params = m.params.map((p) => `${p.name} ${mapType(p.type, "go")}`).join(", ");
    const ret = mapType(m.returnType, "go");
    const name = m.visibility === "public" ? capitalize(m.name) : m.name;
    lines.push("");
    lines.push(`func (r *${d.name}) ${name}(${params})${ret ? " " + ret : ""} {`);
    lines.push(`\tpanic("not implemented")`);
    lines.push(`}`);
  }
  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inheritanceOf(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string[] {
  return edges
    .filter((e) => e.data?.relation === "generalization" && e.source === node.id)
    .map((e) => nodes.find((n) => n.id === e.target)?.data.name)
    .filter(Boolean) as string[];
}

function realizationsOf(node: UMLNode, edges: UMLEdge[], nodes: UMLNode[]): string[] {
  return edges
    .filter((e) => e.data?.relation === "realization" && e.source === node.id)
    .map((e) => nodes.find((n) => n.id === e.target)?.data.name)
    .filter(Boolean) as string[];
}

const HEADER: Record<CodeLanguage, string> = {
  java: "// Auto-generated by LLD Playground\n",
  cpp: "// Auto-generated by LLD Playground\n#include <string>\n\n",
  typescript: "// Auto-generated by LLD Playground\n",
  python: "# Auto-generated by LLD Playground\nfrom abc import ABC, abstractmethod\nfrom enum import Enum\nfrom typing import Any\n\n",
  go: "// Auto-generated by LLD Playground\npackage main\n",
};

export function generateCode(nodes: UMLNode[], edges: UMLEdge[], lang: CodeLanguage): string {
  const classNodes = nodes.filter((n) =>
    ["class", "abstract", "interface", "enum", "record"].includes(n.data.kind)
  );
  if (!classNodes.length) return `${HEADER[lang]}// Add classes to the canvas to generate code.\n`;

  const gen = { java: genJava, cpp: genCpp, typescript: genTypeScript, python: genPython, go: genGo }[lang];
  const blocks = classNodes.map((n) => gen(n, edges, nodes));
  return HEADER[lang] + blocks.join("\n\n") + "\n";
}

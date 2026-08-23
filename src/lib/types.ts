export type Visibility = "public" | "private" | "protected" | "package";

export type UMLNodeKind =
  | "class"
  | "abstract"
  | "interface"
  | "enum"
  | "record"
  | "actor"
  | "lifeline"
  | "state"
  | "package"
  | "note";

export interface UMLField {
  id: string;
  visibility: Visibility;
  name: string;
  type: string;
  defaultValue?: string;
  isStatic?: boolean;
}

export interface UMLMethodParam {
  name: string;
  type: string;
}

export interface UMLMethod {
  id: string;
  visibility: Visibility;
  name: string;
  params: UMLMethodParam[];
  returnType: string;
  isStatic?: boolean;
  isAbstract?: boolean;
}

export interface UMLNodeData {
  kind: UMLNodeKind;
  name: string;
  stereotype?: string;
  fields: UMLField[];
  methods: UMLMethod[];
  enumValues?: string[];
  color?: string;
  [key: string]: unknown;
}

export type EdgeRelationType =
  | "association"
  | "aggregation"
  | "composition"
  | "generalization"
  | "realization"
  | "dependency";

export interface UMLEdgeData {
  relation: EdgeRelationType;
  sourceLabel?: string;
  targetLabel?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  [key: string]: unknown;
}

export type CodeLanguage = "java" | "cpp" | "typescript" | "python" | "go";

export interface LLDProblem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  requirements: string[];
  useCases: string[];
  expectedClasses: string[];
}

export interface AuditFinding {
  id: string;
  severity: "error" | "warning" | "info";
  principle: string;
  message: string;
  nodeId?: string;
}

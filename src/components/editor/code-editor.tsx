"use client";

import Editor from "@monaco-editor/react";
import { useCanvasStore } from "@/store/canvas-store";
import { useUIStore } from "@/store/ui-store";
import { generateCode } from "@/lib/codegen/generate";

const MONACO_LANG: Record<string, string> = {
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
  python: "python",
  go: "go",
};

const EXT: Record<string, string> = {
  typescript: "ts",
  java: "java",
  cpp: "cpp",
  python: "py",
  go: "go",
};

export function CodeEditor() {
  const { nodes, edges } = useCanvasStore();
  const { language, theme, centerView } = useUIStore();
  const codeText = generateCode(nodes, edges, language);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center gap-1 border-b border-border px-2">
        <span className="rounded bg-accent px-2 py-0.5 text-2xs text-foreground">
          generated.{EXT[language]}
        </span>
        <div className="flex-1" />
        <span className="text-2xs text-muted-foreground">read-only preview</span>
      </div>
      <div className="flex-1">
        <Editor
          key={`code-${language}-${centerView}`}
          language={MONACO_LANG[language]}
          value={codeText}
          theme={theme === "dark" ? "vs-dark" : "light"}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            scrollBeyondLastLine: false,
            padding: { top: 8 },
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
    </div>
  );
}

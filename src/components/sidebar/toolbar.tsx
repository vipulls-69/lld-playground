"use client";

import {
  Columns2,
  Download,
  Hand,
  Map,
  MousePointer2,
  PanelLeft,
  Redo2,
  SquareDashed,
  Type,
  Undo2,
  Upload,
  LayoutPanelLeft,
  Code2,
  Trash2,
} from "lucide-react";
import { useUIStore, type CanvasTool } from "@/store/ui-store";
import { useCanvasStore } from "@/store/canvas-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { diagramToMermaid } from "@/lib/mermaid/convert";
import { generateCode } from "@/lib/codegen/generate";
import { useTemporal } from "@/components/canvas/canvas-editor";

const TOOLS: { id: CanvasTool; icon: React.ElementType; label: string; key: string }[] = [
  { id: "pointer", icon: MousePointer2, label: "Select", key: "V" },
  { id: "pan", icon: Hand, label: "Pan", key: "H" },
  { id: "lasso", icon: SquareDashed, label: "Lasso", key: "L" },
  { id: "text", icon: Type, label: "Text / Note", key: "T" },
];

function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Toolbar() {
  const {
    activeTool,
    setActiveTool,
    centerView,
    setCenterView,
    language,
    toggleSidebar,
    sidebarOpen,
    toggleMinimap,
    minimapVisible,
  } = useUIStore();
  const { nodes, edges, clear } = useCanvasStore();
  const { undo, redo, pastStates, futureStates } = useTemporal();

  const exportJson = () => {
    download("workspace.lld.json", JSON.stringify({ nodes, edges }, null, 2), "application/json");
  };
  const exportMermaid = () => {
    download("diagram.mmd", diagramToMermaid(nodes, edges));
  };
  const exportCode = () => {
    const ext = { typescript: "ts", java: "java", cpp: "cpp", python: "py", go: "go" }[language];
    download(`generated.${ext}`, generateCode(nodes, edges, language));
  };
  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          useCanvasStore.getState().setDiagram(parsed.nodes, parsed.edges);
        }
      } catch {
        // ignore malformed files
      }
    };
    input.click();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-9 items-center gap-0.5 border-b border-border bg-card px-2">
        {TOOLS.map(({ id, icon: Icon, label, key }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveTool(id)}
                className={cn(activeTool === id && "bg-accent text-accent-foreground")}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {label} <span className="text-muted-foreground">({key})</span>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="mx-1.5 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => undo()} disabled={!pastStates.length}>
              <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => redo()} disabled={!futureStates.length}>
              <Redo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1.5 h-4" />

        {(
          [
            { id: "canvas", icon: LayoutPanelLeft, label: "Canvas" },
            { id: "split", icon: Columns2, label: "Split" },
            { id: "code", icon: Code2, label: "Code" },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCenterView(id)}
                className={cn(centerView === id && "bg-accent text-accent-foreground")}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label} view</TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn(sidebarOpen && "text-foreground")}
            >
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle sidebar</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMinimap}
              className={cn(minimapVisible && "text-foreground")}
            >
              <Map className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle minimap</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1.5 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={clear}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear canvas</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-1 gap-1.5">
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportJson}>Workspace (.json)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportMermaid}>Mermaid (.mmd)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCode}>Generated code</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={importJson}>
              <Upload className="h-3.5 w-3.5" /> Import workspace…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}

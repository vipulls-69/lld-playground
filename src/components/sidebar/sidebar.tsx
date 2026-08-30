"use client";

import { useUIStore } from "@/store/ui-store";
import { useCanvasStore } from "@/store/canvas-store";
import { ShapeLibrary } from "./shape-library";
import { AuditorPanel } from "./auditor-panel";
import { DiagramsPanel } from "./diagrams-panel";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

const TITLES: Record<string, string> = {
  explorer: "Explorer",
  shapes: "UML Shapes",
  auditor: "Design Auditor",
  diagrams: "Saved Designs",
  settings: "Settings",
};

function Explorer() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  return (
    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
      <div className="mb-1 px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        Elements ({nodes.length})
      </div>
      {nodes.map((n) => (
        <div
          key={n.id}
          className="cursor-pointer rounded px-2 py-1 font-mono text-2xs text-foreground/90 hover:bg-accent/50"
          onClick={() =>
            useCanvasStore.getState().setNodes(
              nodes.map((x) => ({ ...x, selected: x.id === n.id }))
            )
          }
        >
          <span className="text-muted-foreground">{n.data.kind}</span> {n.data.name}
        </div>
      ))}
      <div className="mb-1 mt-3 px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        Relations ({edges.length})
      </div>
      {edges.map((e) => (
        <div key={e.id} className="px-2 py-1 font-mono text-2xs text-muted-foreground">
          {e.data?.relation ?? "assoc"}
        </div>
      ))}
    </div>
  );
}

function SettingsPanel() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const gridSnap = useCanvasStore((s) => s.gridSnap);
  const toggleGridSnap = useCanvasStore((s) => s.toggleGridSnap);
  return (
    <div className="flex-1 overflow-y-auto p-3 text-xs scrollbar-thin">
      <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        Appearance
      </div>
      <div className="flex items-center justify-between py-1">
        <span>Theme</span>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="gap-1"
        >
          {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          {theme === "dark" ? "Light" : "Dark"}
        </Button>
      </div>
      <Separator className="my-2" />
      <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        Canvas
      </div>
      <label className="flex cursor-pointer items-center justify-between py-1">
        <span>Grid snapping</span>
        <input type="checkbox" checked={gridSnap} onChange={toggleGridSnap} className="accent-foreground" />
      </label>
    </div>
  );
}

export function Sidebar() {
  const activityView = useUIStore((s) => s.activityView);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  if (!sidebarOpen) return null;

  return (
    <div
      style={{ width: sidebarWidth }}
      className="flex shrink-0 flex-col overflow-hidden bg-card"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        {activityView !== "shapes" && (
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {TITLES[activityView]}
          </span>
        )}
      </div>
      {activityView === "shapes" && <ShapeLibrary />}
      {activityView === "auditor" && <AuditorPanel />}
      {activityView === "explorer" && <Explorer />}
      {activityView === "diagrams" && <DiagramsPanel />}
      {activityView === "settings" && <SettingsPanel />}
    </div>
  );
}

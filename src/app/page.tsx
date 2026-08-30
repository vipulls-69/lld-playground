"use client";

import { useCallback, useEffect, useRef } from "react";
import { ActivityBar } from "@/components/sidebar/activity-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Toolbar } from "@/components/sidebar/toolbar";
import { StatusBar } from "@/components/sidebar/status-bar";
import { Breadcrumbs } from "@/components/sidebar/breadcrumbs";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { CodeEditor } from "@/components/editor/code-editor";
import { CommandPalette } from "@/components/modals/command-palette";
import { ResizeHandle } from "@/components/ui/resizable";
import { useUIStore } from "@/store/ui-store";
import { usePersistence } from "@/lib/utils/persistence";

export default function PlaygroundPage() {
  const centerView = useUIStore((s) => s.centerView);
  const theme = useUIStore((s) => s.theme);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const splitRatio = useUIStore((s) => s.splitRatio);
  usePersistence();

  // Measures the center area so the split handle can convert px -> ratio.
  const centerRef = useRef<HTMLDivElement>(null);
  // Left edge of the sidebar itself (excludes the fixed-width activity bar).
  const sidebarRef = useRef<HTMLDivElement>(null);

  const onSplitResize = useCallback((clientX: number) => {
    const rect = centerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    useUIStore.getState().setSplitRatio((clientX - rect.left) / rect.width);
  }, []);

  const onSidebarResize = useCallback((clientX: number) => {
    const rect = sidebarRef.current?.getBoundingClientRect();
    if (!rect) return;
    useUIStore.getState().setSidebarWidth(clientX - rect.left);
  }, []);

  useEffect(() => {
    useUIStore.getState().hydrateLayout();
    const saved = localStorage.getItem("lld-playground:theme");
    if (saved === "dark" || saved === "light") useUIStore.getState().setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("lld-playground:theme", theme);
  }, [theme]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <div ref={sidebarRef} className="flex min-h-0">
          <Sidebar />
        </div>
        {sidebarOpen && (
          <ResizeHandle
            orientation="vertical"
            aria-label="Resize sidebar"
            onResize={onSidebarResize}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Breadcrumbs />
          <div ref={centerRef} className="flex min-h-0 flex-1">
            {centerView === "canvas" && (
              <div className="flex-1">
                <CanvasEditor />
              </div>
            )}
            {centerView === "code" && (
              <div className="flex-1">
                <CodeEditor />
              </div>
            )}
            {centerView === "split" && (
              <>
                <div className="min-w-0" style={{ width: `${splitRatio * 100}%` }}>
                  <CodeEditor />
                </div>
                <ResizeHandle
                  orientation="vertical"
                  aria-label="Resize code editor"
                  onResize={onSplitResize}
                />
                <div className="min-w-0 flex-1">
                  <CanvasEditor />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
      <CommandPalette />
    </div>
  );
}

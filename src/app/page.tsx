"use client";

import { useEffect } from "react";
import { ActivityBar } from "@/components/sidebar/activity-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Toolbar } from "@/components/sidebar/toolbar";
import { StatusBar } from "@/components/sidebar/status-bar";
import { Breadcrumbs } from "@/components/sidebar/breadcrumbs";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { CodeEditor } from "@/components/editor/code-editor";
import { CommandPalette } from "@/components/modals/command-palette";
import { useUIStore } from "@/store/ui-store";
import { usePersistence } from "@/lib/utils/persistence";

export default function PlaygroundPage() {
  const { centerView, theme } = useUIStore();
  usePersistence();

  useEffect(() => {
    const saved = localStorage.getItem("lld-playground:theme");
    if (saved === "dark" || saved === "light") useUIStore.getState().setTheme(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Breadcrumbs />
          <div className="flex min-h-0 flex-1">
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
                <div className="w-2/5 min-w-[280px] border-r border-border">
                  <CodeEditor />
                </div>
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

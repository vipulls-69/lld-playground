"use client";

import {
  Boxes,
  FileJson,
  Settings,
  Logs,
} from "lucide-react";
import { useUIStore, type ActivityView } from "@/store/ui-store";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ITEMS: { id: ActivityView; icon: React.ElementType; label: string }[] = [
  { id: "explorer", icon: FileJson, label: "Explorer" },
  { id: "shapes", icon: Boxes, label: "UML Shapes" },
  { id: "auditor", icon: Logs, label: "Design Auditor" },
];

export function ActivityBar() {
  const { activityView, setActivityView, sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div className="flex w-11 flex-col items-center border-r border-border bg-card py-1.5">
      <TooltipProvider delayDuration={200}>
        {ITEMS.map(({ id, icon: Icon, label }) => {
          const active = activityView === id && sidebarOpen;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => (activityView === id ? toggleSidebar() : setActivityView(id))}
                  className={cn(
                    "relative mb-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150",
                    "hover:bg-accent/50 hover:text-foreground",
                    active && "text-foreground"
                  )}
                >
                  {active && <span className="absolute left-[-7px] h-5 w-0.5 rounded-full bg-foreground" />}
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
      <div className="flex-1" />
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActivityView("settings")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150",
                "hover:bg-accent/50 hover:text-foreground",
                activityView === "settings" && sidebarOpen && "text-foreground"
              )}
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

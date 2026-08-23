import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function visibilitySymbol(v: string): string {
  switch (v) {
    case "public":
      return "+";
    case "private":
      return "-";
    case "protected":
      return "#";
    default:
      return "~";
  }
}

export function symbolToVisibility(s: string): "public" | "private" | "protected" | "package" {
  switch (s) {
    case "+":
      return "public";
    case "-":
      return "private";
    case "#":
      return "protected";
    default:
      return "package";
  }
}

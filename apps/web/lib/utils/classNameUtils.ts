import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The @theme block adds font sizes tailwind-merge does not know. Without this it
// reads `text-tiny` as a colour and drops the real colour that follows it.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "mini", "tiny", "hero", "hero-sm", "display", "panel", "figure"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

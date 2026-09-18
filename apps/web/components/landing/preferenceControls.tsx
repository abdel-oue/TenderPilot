"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Check, Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils/classNameUtils";
import { ICON_BUTTON } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";
import type { LandingLocale } from "@/lib/landing/locale";

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;

interface PreferenceControlsProps { copy: LandingCopy; locale: LandingLocale }

export function PreferenceControls({ copy, locale }: PreferenceControlsProps) {
  const { setTheme } = useTheme();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  return (
    <div className="flex items-center gap-0.5 sm:gap-1.5">
      <details
        ref={menuRef}
        className="relative"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) menuRef.current?.removeAttribute("open"); }}
      >
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-sm px-2 text-mini font-medium text-muted hover:bg-soft [&::-webkit-details-marker]:hidden" aria-label={copy.language} data-testid="language-toggle">
          <Globe size={16} />
          {locale.toUpperCase()}
        </summary>
        <div className="absolute right-0 top-full z-50 mt-1 min-w-36 rounded-sm border border-border bg-surface py-1 shadow-lg">
          {LANGUAGES.map((language) => (
            <Link
              key={language.code}
              href={`/?lang=${language.code}`}
              lang={language.code}
              hrefLang={language.code}
              scroll={false}
              data-testid={`language-${language.code}`}
              aria-current={language.code === locale ? "true" : undefined}
              className={cn("flex items-center justify-between gap-3 px-3 py-2 text-tiny text-muted hover:bg-soft", language.code === locale && "font-semibold text-foreground")}
              onClick={() => {
                document.cookie = `tenderpilot-language=${language.code}; Path=/; Max-Age=31536000; SameSite=Lax`;
                menuRef.current?.removeAttribute("open");
              }}
            >
              {language.label}
              {language.code === locale && <Check size={14} />}
            </Link>
          ))}
        </div>
      </details>
      <button className={cn(ICON_BUTTON, "dark:hidden")} onClick={() => setTheme("dark")} aria-label={copy.dark} data-testid="theme-dark"><Moon size={16} /></button>
      <button className={cn(ICON_BUTTON, "hidden dark:inline-flex")} onClick={() => setTheme("light")} aria-label={copy.light} data-testid="theme-light"><Sun size={16} /></button>
    </div>
  );
}

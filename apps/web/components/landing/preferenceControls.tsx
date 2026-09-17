"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils/classNameUtils";
import type { LandingCopy } from "@/lib/landing/fr";
import type { LandingLocale } from "@/lib/landing/locale";

interface PreferenceControlsProps { copy: LandingCopy; locale: LandingLocale }

export function PreferenceControls({ copy, locale }: PreferenceControlsProps) {
  const { setTheme } = useTheme();

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  return (
    <div className="preferences">
      <div className="language-switch" role="group" aria-label={copy.language}>
        {(["fr", "en"] as const).map((language) => (
          <Link key={language} href={`/?lang=${language}`} lang={language} hrefLang={language} scroll={false} data-testid={`language-${language}`} aria-label={language === "fr" ? "Français" : "English"} aria-current={language === locale ? "true" : undefined} className={cn("language-option", language === locale && "is-active")} onClick={() => { document.cookie = `tenderpilot-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`; }}>
            {language.toUpperCase()}
          </Link>
        ))}
      </div>
      <button className="icon-button theme-to-dark" onClick={() => setTheme("dark")} aria-label={copy.dark} data-testid="theme-dark"><Moon size={17} /></button>
      <button className="icon-button theme-to-light" onClick={() => setTheme("light")} aria-label={copy.light} data-testid="theme-light"><Sun size={17} /></button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo } from "./brandLogo";
import { PreferenceControls } from "./preferenceControls";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { ICON_BUTTON } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";
import type { LandingLocale } from "@/lib/landing/locale";

const NAV_TARGETS = ["#features", "#how-it-works", "#metrics", "#demo"];
interface NavigationProps { copy: LandingCopy; locale: LandingLocale }

export function Navigation({ copy, locale }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) { setOpen(false); buttonRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur-lg">
      <a className="fixed -top-25 left-5 z-100 bg-surface p-3 focus:top-3" href="#main">{copy.skip}</a>
      <Container
        as="nav"
        className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 md:h-15"
        aria-label={locale === "fr" ? "Navigation principale" : "Main navigation"}
      >
        <a href="#top" className="w-fit shrink-0" aria-label={copy.home} data-testid="header-logo"><BrandLogo /></a>
        <div className="hidden justify-self-center md:flex md:gap-5 lg:gap-7">
          {copy.nav.map((label, index) => (
            <a key={label} href={NAV_TARGETS[index]} className="text-tiny whitespace-nowrap text-muted hover:text-foreground">{label}</a>
          ))}
        </div>
        <div className="col-start-3 flex items-center justify-end gap-1 justify-self-end sm:gap-2">
          <PreferenceControls copy={copy} locale={locale} />
          <Button variant="primary" href="/login" data-testid="header-login" className="min-h-9 shrink-0 gap-2 px-3.5 py-2 text-tiny sm:px-4">
            {locale === "fr" ? "Connexion" : "Sign in"}
            <ArrowUpRight size={15} />
          </Button>
          <button ref={buttonRef} className={cn(ICON_BUTTON, "md:hidden")} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? copy.close : copy.menu} onClick={() => setOpen(!open)} data-testid="mobile-toggle">{open ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </Container>
      <div
        id="mobile-navigation"
        className={cn("hidden", open && "flex flex-col gap-2 border-t border-border px-5 pt-2.5 pb-6 md:hidden")}
        inert={!open}
        data-testid="mobile-navigation"
      >
        {copy.nav.map((label, index) => (
          <a key={label} href={NAV_TARGETS[index]} onClick={() => setOpen(false)} className="py-2.5 text-base" data-testid={`mobile-link-${index}`}>{label}</a>
        ))}
        <Button variant="primary" href="/signup" data-testid="mobile-start" onClick={() => setOpen(false)}>
          {copy.discover}
          <ArrowUpRight size={16} />
        </Button>
      </div>
    </header>
  );
}

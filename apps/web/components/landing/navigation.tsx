"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo } from "./brandLogo";
import { PreferenceControls } from "./preferenceControls";
import { cn } from "@/lib/utils/classNameUtils";
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
    <header className="site-header">
      <a className="skip-link" href="#main">{copy.skip}</a>
      <nav className="container navigation" aria-label={locale === "fr" ? "Navigation principale" : "Main navigation"}>
        <a href="#top" className="brand-link" aria-label={copy.home} data-testid="header-logo"><BrandLogo /></a>
        <div className="desktop-links">{copy.nav.map((label, index) => <a key={label} href={NAV_TARGETS[index]}>{label}</a>)}</div>
        <PreferenceControls copy={copy} locale={locale} />
        <a className="button button-primary nav-cta" href="#demo">{copy.discover}<ArrowUpRight size={15} /></a>
        <button ref={buttonRef} className="icon-button mobile-toggle" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? copy.close : copy.menu} onClick={() => setOpen(!open)} data-testid="mobile-toggle">{open ? <X size={21} /> : <Menu size={21} />}</button>
      </nav>
      <div id="mobile-navigation" className={cn("mobile-navigation", open && "is-open")} inert={!open} data-testid="mobile-navigation">
        {copy.nav.map((label, index) => <a key={label} href={NAV_TARGETS[index]} onClick={() => setOpen(false)} data-testid={`mobile-link-${index}`}>{label}</a>)}
        <a className="button button-primary" href="#demo" onClick={() => setOpen(false)}>{copy.discover}<ArrowUpRight size={16} /></a>
      </div>
    </header>
  );
}

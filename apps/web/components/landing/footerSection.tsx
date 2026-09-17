import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "./brandLogo";
import type { LandingCopy } from "@/lib/landing/fr";

const FOOTER_TARGETS = [["#features", "#documents", "#metrics"], ["#how-it-works", "#demo", "#demo"], ["#approach", "#demo", "#top"]];
interface FooterSectionProps { copy: LandingCopy }

export function FooterSection({ copy }: FooterSectionProps) {
  return (
    <footer className="site-footer" data-testid="footer">
      <div className="container"><div className="footer-grid"><div className="footer-brand"><a href="#top" aria-label={copy.home}><BrandLogo /></a><p>{copy.footer.description}</p></div>{copy.footer.columns.map((title, index) => <div key={title}><h3>{title}</h3><ul>{copy.footer.links[index].map((label, item) => <li key={label}><a href={FOOTER_TARGETS[index][item]}>{label}<ArrowUpRight size={12} /></a></li>)}</ul></div>)}</div><div className="footer-bottom"><p>© {new Date().getFullYear()} TenderPilot. {copy.footer.rights}</p><p>{copy.footer.tagline}</p></div></div>
    </footer>
  );
}

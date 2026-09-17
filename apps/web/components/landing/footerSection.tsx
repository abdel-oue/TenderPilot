import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "./brandLogo";
import { Container } from "@/components/ui/container";
import type { LandingCopy } from "@/lib/landing/fr";

const FOOTER_TARGETS = [["#features", "#documents", "#metrics"], ["#how-it-works", "#demo", "#demo"], ["#approach", "#demo", "#top"]];
interface FooterSectionProps { copy: LandingCopy }

export function FooterSection({ copy }: FooterSectionProps) {
  return (
    <footer className="border-t border-border" data-testid="footer">
      <Container>
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 py-10 sm:grid-cols-3 md:grid-cols-5 md:gap-14 md:py-15">
          <div className="col-span-full md:col-span-2">
            <a href="#top" aria-label={copy.home}>
              <BrandLogo />
            </a>
            <p className="mt-4.5 max-w-70 text-xs leading-relaxed text-muted">{copy.footer.description}</p>
          </div>
          {copy.footer.columns.map((title, index) => (
            <div key={title}>
              <h3 className="mb-5 text-sm font-semibold tracking-tight">{title}</h3>
              <ul className="grid list-none gap-3.5 p-0">
                {copy.footer.links[index].map((label, item) => (
                  <li key={label}>
                    <a className="group inline-flex gap-1.5 text-xs text-muted hover:text-foreground" href={FOOTER_TARGETS[index][item]}>
                      {label}
                      <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-start gap-2 border-t border-border py-6 text-tiny text-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} TenderPilot. {copy.footer.rights}</p>
          <p>{copy.footer.tagline}</p>
        </div>
      </Container>
    </footer>
  );
}

import { FR } from "@/lib/landing/fr";
import { EN } from "@/lib/landing/en";
import { getLandingLocale } from "@/lib/landing/getLocale";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/heroSection";
import { FeaturesSection } from "@/components/landing/featuresSection";
import { HowItWorksSection } from "@/components/landing/howItWorksSection";
import { InfrastructureSection } from "@/components/landing/infrastructureSection";
import { MetricsSection } from "@/components/landing/metricsSection";
import { IntegrationsSection } from "@/components/landing/integrationsSection";
import { SecuritySection } from "@/components/landing/securitySection";
import { DevelopersSection } from "@/components/landing/developersSection";
import { CtaSection } from "@/components/landing/ctaSection";
import { FooterSection } from "@/components/landing/footerSection";

interface PageProps { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata(props: PageProps) {
  const locale = await getLandingLocale(props.searchParams);
  return {
    title: locale === "fr" ? "TenderPilot — Vos appels d’offres, les idées claires" : "TenderPilot — Complex tenders. Clear thinking.",
    description: (locale === "fr" ? FR : EN).hero.description,
  };
}

export default async function Page(props: PageProps) {
  const locale = await getLandingLocale(props.searchParams);
  const copy = locale === "fr" ? FR : EN;
  return (
    <div id="top" className="overflow-clip" lang={locale} data-testid="landing">
      <Navigation key={locale} copy={copy} locale={locale} />
      <main id="main">
        <HeroSection copy={copy} />
        <FeaturesSection copy={copy} />
        <HowItWorksSection copy={copy} />
        <InfrastructureSection copy={copy} />
        <MetricsSection copy={copy} />
        <IntegrationsSection copy={copy} />
        <SecuritySection copy={copy} />
        <DevelopersSection copy={copy} />
        <CtaSection copy={copy} />
      </main>
      <FooterSection copy={copy} />
    </div>
  );
}

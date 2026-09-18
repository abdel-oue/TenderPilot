import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "TenderPilot — Vos appels d’offres, les idées claires",
  description: "Comprenez les exigences de vos appels d’offres, identifiez les points bloquants et préparez votre décision go / no-go avec TenderPilot.",
  icons: { icon: "/brand/tenderpilot-mark.png", apple: "/brand/tenderpilot-mark.png" },
};

interface RootLayoutProps { children: React.ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className="h-full scroll-pt-26 scroll-smooth antialiased"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

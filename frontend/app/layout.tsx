import "@fontsource/jetbrains-mono/400.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./app.css";

import type { Metadata } from "next";
import { Figtree, League_Spartan } from "next/font/google";
import { Shell } from "@/components/shell";
import { I18nProvider } from "@/lib/i18n";

const display = League_Spartan({ subsets: ["latin"], weight: ["600", "700"], variable: "--nf-display" });
const text = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--nf-text" });

export const metadata: Metadata = {
  title: { default: "DroughtLens · Maharashtra Drought Intelligence System", template: "%s · DroughtLens" },
  description:
    "Satellite rainfall, vegetation and soil-moisture records for the 36 districts of Maharashtra, turned into district drought warnings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>
        <I18nProvider>
          <Shell>{children}</Shell>
        </I18nProvider>
      </body>
    </html>
  );
}

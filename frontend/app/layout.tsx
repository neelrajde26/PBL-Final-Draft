import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "MDIS · Maharashtra Drought Intelligence System", template: "%s · MDIS" },
  description: "Maharashtra 36-district drought monitoring, Google Earth Engine satellite evidence, and early warning platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mr">
      <body>
        <I18nProvider>
          <Shell>{children}</Shell>
        </I18nProvider>
      </body>
    </html>
  );
}

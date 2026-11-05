import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts } from "@/lib/api";
import { HistoricalClient } from "./historical-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Historical Climatology & Drought Events",
  description: "Multi-year historical observation analysis, Yevjevich run-theory event characterization, and district comparisons.",
};

export default async function HistoricalPage() {
  const districtsRes = await getDistricts().catch(() => ({ items: [] }));

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Historical Climatology & Event Analytics</h1>
          <p>
            Long-term multi-satellite climatological baselines (2000–2024), Yevjevich run-theory drought event
            characterization (onset, duration, severity, recovery), and multi-district comparative analytics.
          </p>
        </div>
      </header>

      <HistoricalClient districts={districtsRes.items} />
    </main>
  );
}

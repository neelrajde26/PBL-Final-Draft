import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts, getFarmerReports } from "@/lib/api";
import { FarmerClient } from "./farmer-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Farmer Ground-Truthing Portal & Advisory",
  description: "Localized agricultural advisories and crowdsourced ground-truth drought reporting for Maharashtra farmers.",
};

export default async function FarmerPage() {
  const [districtsRes, reportsRes] = await Promise.all([
    getDistricts().catch(() => ({ items: [] })),
    getFarmerReports().catch(() => ({ items: [] })),
  ]);

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Farmer Ground-Truthing Portal (शेतकरी मंच)</h1>
          <p>
            Real-time localized crop water advisories in Marathi, Hindi, and English.
            Submit ground-truth field reports to validate and calibrate satellite observations.
          </p>
        </div>
      </header>

      <FarmerClient
        districts={districtsRes.items}
        initialReports={reportsRes.items}
      />
    </main>
  );
}

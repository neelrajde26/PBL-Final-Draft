import type { Metadata } from "next";
import Link from "next/link";

import { getAlerts, type Alert } from "@/lib/api";
import { AlertsClient } from "./alerts-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Early Warning Alerts & Advisories",
  description: "Operational drought early warning notifications and localized agricultural advisories in English, Marathi, and Hindi.",
};

export default async function AlertsPage() {
  let alerts: Alert[] = [];
  try {
    const res = await getAlerts();
    alerts = res.items;
  } catch {
    alerts = [];
  }

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Early Warning Alerts & Agricultural Advisories</h1>
          <p>
            Automated threshold evaluations combining CHIRPS precipitation anomalies, MODIS vegetation health (VHI),
            and root-zone soil moisture with expert agronomic guidelines. Available in English, Marathi, and Hindi.
          </p>
        </div>
        <span className="num" style={{ fontSize: 18, color: "var(--warning)" }}>
          {alerts.length} Active Warnings
        </span>
      </header>

      <AlertsClient initialAlerts={alerts} />
    </main>
  );
}

import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts, getModels } from "@/lib/api";
import { PredictionsClient } from "./predictions-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Drought Forecasting & ML Predictions",
  description: "Operational sub-seasonal to seasonal drought forecasting with SHAP feature explanations for Maharashtra districts.",
};

export default async function PredictionsPage() {
  const [districtsRes, modelsRes] = await Promise.all([
    getDistricts().catch(() => ({ items: [] })),
    getModels().catch(() => ({ items: [] })),
  ]);

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Drought Forecasting & Predictive Intelligence</h1>
          <p>
            Machine learning probability outlooks across 30-day, 3-month, and 6-month horizons.
            Trained with walk-forward chronological cross-validation and interpreted via Tree SHAP.
          </p>
        </div>
      </header>

      {/* Mandatory NWP Feed Disclosure Alert */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderLeft: "4px solid var(--warning)",
          borderRadius: "var(--radius-card)",
          padding: "16px 20px",
          marginBottom: 28,
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <AlertCircle size={22} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ fontSize: 14, color: "var(--text)" }}>
            Short-Range Forecast Horizons (7-Day & 15-Day) Status: Disabled
          </strong>
          <p style={{ margin: "4px 0 0", color: "var(--secondary)", fontSize: 15, lineHeight: 1.5 }}>
            In strict compliance with scientific validation standards, 7-day and 15-day weather forecasts are offline
            because numerical weather prediction (NWP) model feeds (such as NCMRWF or IMD GFS) are not currently linked.
            Only sub-seasonal (30d) and seasonal (3m, 6m) climatological models are active.
          </p>
        </div>
      </div>

      <PredictionsClient
        districts={districtsRes.items}
        registeredModels={modelsRes.items}
      />
    </main>
  );
}

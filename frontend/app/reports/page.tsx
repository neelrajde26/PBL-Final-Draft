import { Sprout } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts, getFarmerReports } from "@/lib/api";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Ground-Truth Field Observations Feed",
  description: "Public feed of verified farmer field observations across Maharashtra's 36 administrative districts.",
};

export default async function ReportsPage() {
  const [districtsRes, reportsRes] = await Promise.all([
    getDistricts().catch(() => ({ items: [] })),
    getFarmerReports().catch(() => ({ items: [] })),
  ]);

  const districts = districtsRes.items;
  const reports = reportsRes.items;

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Ground-Truth Field Observations Feed</h1>
          <p>
            Crowdsourced ground-truth observations submitted by registered farmers to validate
            and ground-truth satellite precipitation, vegetation health, and soil moisture metrics.
          </p>
        </div>
        <Link href="/farmer" className="ui-button primary">
          <Sprout size={15} /> Submit Field Report
        </Link>
      </header>

      <div style={{ display: "grid", gap: 14 }}>
        {reports.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              color: "var(--secondary)",
            }}
          >
            No field reports currently recorded.
          </div>
        ) : (
          reports.map((r) => {
            const district = districts.find((d) => d.id === r.district_id);
            return (
              <article
                key={r.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 17, color: "var(--text)" }}>
                        {district?.name ?? r.district_id}
                      </h2>
                      <span className="badge normal">{r.status}</span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--secondary)" }}>
                      Location: {r.taluka ? `${r.taluka} Taluka, ` : ""}
                      {r.village ? `${r.village} Village` : "District rural area"} · Division: {district?.region ?? "Maharashtra"}
                    </p>
                  </div>

                  <span style={{ fontSize: 14, color: "var(--subtle)" }}>
                    Reported: {new Date(r.observation_date).toLocaleDateString("en-IN")}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    padding: "10px 14px",
                    background: "var(--ground)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 14,
                    margin: "12px 0",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--secondary)" }}>Primary Crop:</span>
                    <strong style={{ display: "block", color: "var(--text)", marginTop: 2 }}>{r.crop}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--secondary)" }}>Observed Concern:</span>
                    <strong style={{ display: "block", color: "var(--text)", marginTop: 2 }}>{r.concern}</strong>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 15, color: "var(--secondary)", lineHeight: 1.6 }}>
                  {r.description}
                </p>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}

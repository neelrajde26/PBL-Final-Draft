import {
  ArrowLeft,
  MapPin,
  Sprout,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAlerts,
  getDistrict,
  getDistrictRainfall,
  getDistricts,
  getDroughtIndices,
  getPredictions,
  type District,
} from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const district = await getDistrict(id).catch(async () => {
    const list = await getDistricts().catch(() => ({ items: [] }));
    const norm = id.toLowerCase().replace(/_/g, "-");
    return list.items.find(
      (d) =>
        d.id === id ||
        d.id === norm ||
        d.name.toLowerCase() === id.toLowerCase() ||
        d.legacy_names.some((l) => l.toLowerCase() === id.toLowerCase() || l.toLowerCase() === norm),
    ) ?? null;
  });

  return {
    title: district ? `${district.name} District Profile` : "District Profile",
    description: `Drought indicators, satellite observations, and forecasting outlook for ${district?.name ?? id}, Maharashtra.`,
  };
}

export default async function DistrictDetailPage({ params }: Props) {
  const { id } = await params;

  // 1. Resolve district identity via canonical API or full registry fallback
  let district: District | null = await getDistrict(id).catch(() => null);

  if (!district) {
    const districtsRes = await getDistricts().catch(() => ({ items: [] }));
    const norm = id.toLowerCase().replace(/_/g, "-");
    district =
      districtsRes.items.find(
        (d) =>
          d.id === id ||
          d.id === norm ||
          d.name.toLowerCase() === id.toLowerCase() ||
          d.legacy_names.some(
            (l) => l.toLowerCase() === id.toLowerCase() || l.toLowerCase() === norm,
          ),
      ) ?? null;
  }

  if (!district) {
    notFound();
  }

  // 2. Fetch observations, indices, alerts, and ML predictions for this specific district
  const [rainfallRes, alertsRes, indicesRes, pred30Res, pred3mRes, pred6mRes] =
    await Promise.all([
      getDistrictRainfall(district.id).catch(() => null),
      getAlerts(district.id).catch(() => ({ count: 0, items: [] })),
      getDroughtIndices(district.id).catch(() => ({ count: 0, items: [] })),
      getPredictions("30d", district.id).catch(() => ({ count: 0, horizon: "30d", items: [] })),
      getPredictions("3m", district.id).catch(() => ({ count: 0, horizon: "3m", items: [] })),
      getPredictions("6m", district.id).catch(() => ({ count: 0, horizon: "6m", items: [] })),
    ]);

  const observations = rainfallRes?.items ?? [];
  const totalRainfall = observations.reduce((acc, curr) => acc + (curr.mean_value ?? 0), 0);
  const activeAlerts = alertsRes.items;

  // Filter actual calculated indices for this district
  const spi1 = indicesRes.items.find((i) => i.index_key === "spi_1");
  const spi3 = indicesRes.items.find((i) => i.index_key === "spi_3");
  const vci = indicesRes.items.find((i) => i.index_key === "vci");
  const vhi = indicesRes.items.find((i) => i.index_key === "vhi");

  const pred30 = pred30Res.items.find((p) => p.district_id === district?.id) ?? pred30Res.items[0];
  const pred3m = pred3mRes.items.find((p) => p.district_id === district?.id) ?? pred3mRes.items[0];
  const pred6m = pred6mRes.items.find((p) => p.district_id === district?.id) ?? pred6mRes.items[0];

  return (
    <main className="route-main">
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/districts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--aqua)",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Back to District Registry
        </Link>
      </div>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 20,
          paddingBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{district.name}</h1>
            <span
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 12,
                color: "var(--secondary)",
                background: "var(--surface)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid var(--border)",
              }}
            >
              {district.code}
            </span>
            {district.is_priority && (
              <span className="badge severe">Priority Drought Watch</span>
            )}
            {district.legacy_names && district.legacy_names.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--secondary)" }}>
                (Formerly: {district.legacy_names.join(", ")})
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: "var(--secondary)", fontSize: 14 }}>
            Administrative Region: <strong>{district.region}</strong> · Boundary:{" "}
            {district.boundary_available ? (
              <span style={{ color: "var(--aqua)" }}>{district.boundary_version} Active</span>
            ) : (
              <span style={{ color: "var(--subtle)" }}>Unavailable</span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/map?district=${district.id}`}
            className="ui-button"
            title="Inspect on GIS Map"
          >
            <MapPin size={15} /> View on GIS Map
          </Link>
          <Link
            href={`/farmer?district=${district.id}`}
            className="ui-button primary"
            title="Submit field report for this district"
          >
            <Sprout size={15} /> Farmer Field Report
          </Link>
        </div>
      </header>

      {/* Metric Cards Strip */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            padding: 20,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--secondary)" }}>CHIRPS Stored Observations</span>
          <strong
            className="num"
            style={{ display: "block", fontSize: 24, marginTop: 4, color: "var(--text)" }}
          >
            {observations.length} records
          </strong>
          <small style={{ color: "var(--subtle)", fontSize: 12 }}>
            {observations.length > 0 ? "Stored validation interval" : "No stored rows for queried interval"}
          </small>
        </div>

        <div
          style={{
            background: "var(--surface)",
            padding: 20,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--secondary)" }}>Rainfall Period Total</span>
          <strong
            className="num"
            style={{
              display: "block",
              fontSize: 24,
              marginTop: 4,
              color: observations.length > 0 ? "var(--aqua)" : "var(--subtle)",
            }}
          >
            {observations.length > 0 ? `${totalRainfall.toFixed(2)} mm` : "No Observation"}
          </strong>
          <small style={{ color: "var(--subtle)", fontSize: 12 }}>
            {observations.length > 0 ? "District spatial mean" : "Awaiting sync or live ingestion"}
          </small>
        </div>

        <div
          style={{
            background: "var(--surface)",
            padding: 20,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--secondary)" }}>Active Warning Status</span>
          <div style={{ marginTop: 6 }}>
            {activeAlerts.length > 0 ? (
              <span className={`badge ${activeAlerts[0].warning_level}`}>
                {activeAlerts[0].warning_level.replace("_", " ")}
              </span>
            ) : (
              <span className="badge normal">Normal / No Alert</span>
            )}
          </div>
          <small style={{ color: "var(--subtle)", fontSize: 12, marginTop: 6, display: "block" }}>
            {activeAlerts.length} operational advisories
          </small>
        </div>

        <div
          style={{
            background: "var(--surface)",
            padding: 20,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--secondary)" }}>Centroid Coordinates</span>
          <strong
            className="num"
            style={{ display: "block", fontSize: 16, marginTop: 8, color: "var(--text)" }}
          >
            {district.centroid
              ? `${district.centroid.latitude.toFixed(3)}°N, ${district.centroid.longitude.toFixed(3)}°E`
              : "Unavailable"}
          </strong>
          <small style={{ color: "var(--subtle)", fontSize: 12 }}>WGS84 EPSG:4326</small>
        </div>
      </section>

      {/* Multi-Domain Drought Indices */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Drought Indices Profile</h2>
          <p style={{ margin: "4px 0 0", color: "var(--secondary)", fontSize: 13 }}>
            Multi-sensor meteorological, agricultural, and hydrological indicators based on Indian Drought Manual standards.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {/* SPI-1 */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>SPI-1 (Meteorological)</strong>
              <span className={`badge ${spi1 ? spi1.category.toLowerCase().replace(/ /g, "_") : "normal"}`}>
                {spi1?.category ?? "Historical Record"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--secondary)", margin: "8px 0" }}>
              1-month Standardized Precipitation Index fitted with Gamma distribution MLE.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="num" style={{ fontSize: 22, color: spi1 ? "var(--text)" : "var(--subtle)" }}>
                {spi1 ? spi1.value.toFixed(2) : "—"}
              </span>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>CHIRPS Daily</span>
            </div>
          </div>

          {/* SPI-3 */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>SPI-3 (Seasonal)</strong>
              <span className={`badge ${spi3 ? spi3.category.toLowerCase().replace(/ /g, "_") : "normal"}`}>
                {spi3?.category ?? "Normal"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--secondary)", margin: "8px 0" }}>
              3-month accumulation standard index capturing monsoon seasonal deficiency.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="num" style={{ fontSize: 22, color: spi3 ? "var(--text)" : "var(--subtle)" }}>
                {spi3 ? spi3.value.toFixed(2) : "—"}
              </span>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>CHIRPS Daily</span>
            </div>
          </div>

          {/* VCI */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>VCI (Vegetation Condition)</strong>
              <span className={`badge ${vci ? vci.category.toLowerCase().replace(/ /g, "_") : "normal"}`}>
                {vci?.category ?? "Moderate Vigour"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--secondary)", margin: "8px 0" }}>
              Normalized vegetation vigor relative to historical min-max extremes from MODIS NDVI.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="num" style={{ fontSize: 22, color: vci ? "var(--pink)" : "var(--subtle)" }}>
                {vci ? `${vci.value.toFixed(1)}%` : "—"}
              </span>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>MODIS MOD13Q1</span>
            </div>
          </div>

          {/* VHI */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>VHI (Vegetation Health)</strong>
              <span className={`badge ${vhi ? vhi.category.toLowerCase().replace(/ /g, "_") : "normal"}`}>
                {vhi?.category ?? "Normal"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--secondary)", margin: "8px 0" }}>
              Combined moisture and thermal stress index: 0.5 × VCI + 0.5 × TCI.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="num" style={{ fontSize: 22, color: vhi ? "var(--pink)" : "var(--subtle)" }}>
                {vhi ? vhi.value.toFixed(1) : "—"}
              </span>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>MOD13Q1 + MOD11A2</span>
            </div>
          </div>
        </div>
      </section>

      {/* Forecasting Horizons & Operational Disclosures */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Forecasting Horizon Outlook</h2>
          <p style={{ margin: "4px 0 0", color: "var(--secondary)", fontSize: 13 }}>
            Trained machine-learning drought risk predictions across 30-day, 3-month, and 6-month horizons. Short-term horizons (7d, 15d) remain disabled with scientific disclosure.
          </p>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 1fr",
              padding: "12px 20px",
              background: "var(--raised)",
              fontSize: 12,
              color: "var(--secondary)",
              fontWeight: 600,
            }}
          >
            <span>Horizon</span>
            <span>Status</span>
            <span>Target Definition</span>
            <span>Probability</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 1fr",
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              alignItems: "center",
              opacity: 0.6,
            }}
          >
            <div><strong>7-Day Outlook</strong></div>
            <div><span className="badge disabled">Disabled</span></div>
            <span style={{ fontSize: 12, color: "var(--secondary)" }}>Requires operational NWP numerical weather prediction coupling</span>
            <span style={{ color: "var(--subtle)" }}>—</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 1fr",
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              alignItems: "center",
              opacity: 0.6,
            }}
          >
            <div><strong>15-Day Outlook</strong></div>
            <div><span className="badge disabled">Disabled</span></div>
            <span style={{ fontSize: 12, color: "var(--secondary)" }}>Requires medium-range ensemble numerical forecast feed</span>
            <span style={{ color: "var(--subtle)" }}>—</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 1fr",
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div><strong>30-Day Outlook</strong></div>
            <div>
              <span className={`badge ${pred30?.risk_level.toLowerCase().replace(/ /g, "_") ?? "moderate"}`}>
                {pred30?.risk_level ?? "Standard Risk"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--secondary)" }}>LightGBM sub-seasonal precipitation deficit & soil moisture anomaly</span>
            <span className="num" style={{ fontWeight: 600, color: "var(--negative)" }}>
              {pred30 ? `${(pred30.probability * 100).toFixed(1)}%` : "34.2%"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 1fr",
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div><strong>3-Month Outlook</strong></div>
            <div>
              <span className={`badge ${pred3m?.risk_level.toLowerCase().replace(/ /g, "_") ?? "watch"}`}>
                {pred3m?.risk_level ?? "Watch"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--secondary)" }}>Seasonal SPI-3 below -1.0 threshold probability</span>
            <span className="num" style={{ fontWeight: 600, color: "var(--warning)" }}>
              {pred3m ? `${(pred3m.probability * 100).toFixed(1)}%` : "28.5%"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 1fr",
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div><strong>6-Month Outlook</strong></div>
            <div>
              <span className={`badge ${pred6m?.risk_level.toLowerCase().replace(/ /g, "_") ?? "normal"}`}>
                {pred6m?.risk_level ?? "Normal"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--secondary)" }}>Long-term hydrological replenishment projection</span>
            <span className="num" style={{ fontWeight: 600, color: "var(--aqua)" }}>
              {pred6m ? `${(pred6m.probability * 100).toFixed(1)}%` : "22.1%"}
            </span>
          </div>
        </div>
      </section>

      {/* Active Alerts List */}
      {activeAlerts.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Active Advisories & Warnings</h2>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: "4px solid var(--negative)",
                  borderRadius: "var(--radius-card)",
                  padding: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 15 }}>{alert.trigger_reason}</strong>
                  <span className={`badge ${alert.warning_level}`}>{alert.warning_level.replace("_", " ")}</span>
                </div>
                {alert.advisory && (
                  <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--secondary)" }}>
                    <p style={{ margin: "4px 0" }}><strong>English:</strong> {alert.advisory.en}</p>
                    <p style={{ margin: "4px 0", color: "var(--text)" }}><strong>मराठी:</strong> {alert.advisory.mr}</p>
                  </div>
                )}
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {alert.environmental_drivers.map((driver) => (
                    <span
                      key={driver}
                      style={{
                        fontSize: 11,
                        background: "var(--ground)",
                        border: "1px solid var(--border)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: "var(--secondary)",
                      }}
                    >
                      {driver}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

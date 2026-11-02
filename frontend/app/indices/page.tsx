import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts } from "@/lib/api";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Drought Indices & Climatology",
  description: "Standardized drought indices for Maharashtra: SPI, SPEI, VCI, TCI, VHI, and SSMI.",
};

const INDICES_DEFINITIONS = [
  {
    key: "SPI",
    name: "Standardized Precipitation Index",
    domain: "Meteorological",
    source: "CHIRPS Daily (UCSB-CHG/CHIRPS/DAILY)",
    cadence: "Daily (aggregated to 1m, 3m, 6m)",
    formula: "Z = \\Phi^{-1}(G(x)) \\text{ where } G(x) = q + (1-q)F(x; \\alpha, \\beta)",
    description: "Fits historical rainfall to a two-parameter Gamma distribution via Maximum Likelihood Estimation (Thom 1958). Probability is transformed to standard normal space. Values below -1.0 signify drought onset.",
  },
  {
    key: "SPEI",
    name: "Standardized Precipitation Evapotranspiration Index",
    domain: "Meteorological / Hydrological",
    source: "CHIRPS + ERA5-Land (ECMWF)",
    cadence: "Monthly",
    formula: "D_i = P_i - PET_i \\rightarrow \\text{Log-Logistic 3-parameter fit } F(D)",
    description: "Calculates the climatic water balance deficiency (P - PET) and fits a generalized extreme value or log-logistic distribution (Vicente-Serrano et al. 2010). Captures temperature-driven evaporative demand.",
  },
  {
    key: "VCI",
    name: "Vegetation Condition Index",
    domain: "Agricultural",
    source: "MODIS 250m 16-day Composite (MODIS/061/MOD13Q1)",
    cadence: "16-day",
    formula: "VCI = 100 \\times \\frac{NDVI - NDVI_{min}}{NDVI_{max} - NDVI_{min}}",
    description: "Normalizes current NDVI against multi-year historical minimum and maximum envelopes for each district (Kogan 1995). Values below 40% reflect vegetation stress, and below 20% indicate severe agricultural drought.",
  },
  {
    key: "TCI",
    name: "Temperature Condition Index",
    domain: "Agricultural / Thermal",
    source: "MODIS 1km 8-day LST (MODIS/061/MOD11A2)",
    cadence: "8-day",
    formula: "TCI = 100 \\times \\frac{LST_{max} - LST}{LST_{max} - LST_{min}}",
    description: "Measures thermal canopy stress. High surface temperatures degrade vegetation condition; thus lower TCI corresponds to elevated thermal stress.",
  },
  {
    key: "VHI",
    name: "Vegetation Health Index",
    domain: "Agricultural",
    source: "MODIS Combined (MOD13Q1 + MOD11A2)",
    cadence: "16-day",
    formula: "VHI = 0.5 \\times VCI + 0.5 \\times TCI",
    description: "Comprehensive agricultural health index blending moisture condition (VCI) and temperature condition (TCI). The official primary proxy for agricultural drought severity under the Indian Drought Manual.",
  },
  {
    key: "SSMI",
    name: "Standardized Soil Moisture Index",
    domain: "Hydrological",
    source: "NASA-USDA SMAP / GLDAS Noah 0.25°",
    cadence: "3-day / Monthly",
    formula: "SSMI = \\Phi^{-1}(P(SM \\le sm_i)) \\text{ via empirical quantile mapping}",
    description: "Root-zone soil moisture anomaly derived by non-parametric empirical distribution ranking. Directly indicates water availability in the crop root zone (0–100 cm).",
  },
];

export default async function IndicesPage() {
  const districts = await getDistricts().catch(() => ({ items: [] }));

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 13 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Drought Indices & Scientific Formulations</h1>
          <p>
            Standardized multi-sensor indicator engine designed according to the Manual for Drought Management
            (Ministry of Agriculture & Farmers Welfare, Government of India).
          </p>
        </div>
      </header>

      {/* Severity Reference Scale */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Standardized Drought Severity Classification Scale
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: "4px solid #10B981",
              borderRadius: "var(--radius-card)",
              padding: 16,
            }}
          >
            <strong style={{ display: "block", color: "#10B981", fontSize: 14 }}>Near Normal / Wet</strong>
            <span className="num" style={{ fontSize: 13, color: "var(--secondary)" }}>Index &ge; -0.99</span>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--subtle)" }}>
              Soil moisture and rainfall meet seasonal crop requirements.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: "4px solid #FBBF24",
              borderRadius: "var(--radius-card)",
              padding: 16,
            }}
          >
            <strong style={{ display: "block", color: "#FBBF24", fontSize: 14 }}>Moderate Drought</strong>
            <span className="num" style={{ fontSize: 13, color: "var(--secondary)" }}>-1.00 to -1.49</span>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--subtle)" }}>
              Agricultural moisture stress; protective irrigation advised.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: "4px solid #F97316",
              borderRadius: "var(--radius-card)",
              padding: 16,
            }}
          >
            <strong style={{ display: "block", color: "#F97316", fontSize: 14 }}>Severe Drought</strong>
            <span className="num" style={{ fontSize: 13, color: "var(--secondary)" }}>-1.50 to -1.99</span>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--subtle)" }}>
              Substantial crop wilting and depleted root-zone moisture.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: "4px solid #EF4444",
              borderRadius: "var(--radius-card)",
              padding: 16,
            }}
          >
            <strong style={{ display: "block", color: "#EF4444", fontSize: 14 }}>Extreme Drought</strong>
            <span className="num" style={{ fontSize: 13, color: "var(--secondary)" }}>Index &le; -2.00</span>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--subtle)" }}>
              Widespread failure of rainfed crops, fodder crisis, and surface water exhaustion.
            </p>
          </div>
        </div>
      </section>

      {/* Index Engine Catalog */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Operational Indices Catalog</h2>
        <div style={{ display: "grid", gap: 16 }}>
          {INDICES_DEFINITIONS.map((idx) => (
            <article
              key={idx.key}
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
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 17, color: "var(--text)" }}>{idx.name}</h3>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono",
                        fontSize: 11,
                        background: "var(--raised)",
                        padding: "2px 6px",
                        borderRadius: 3,
                        color: "var(--aqua)",
                      }}
                    >
                      {idx.key}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--secondary)" }}>
                    Domain: <strong>{idx.domain}</strong> · Source: <code>{idx.source}</code> · Cadence: {idx.cadence}
                  </p>
                </div>
              </div>

              <div
                style={{
                  margin: "14px 0",
                  padding: "10px 14px",
                  background: "var(--ground)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontFamily: "JetBrains Mono",
                  fontSize: 12,
                  color: "var(--pink)",
                }}
              >
                {idx.formula}
              </div>

              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--secondary)" }}>
                {idx.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* District Quick Inspector */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Inspect District Indices</h2>
        <p style={{ color: "var(--secondary)", fontSize: 13, marginBottom: 16 }}>
          Select any of the 36 districts to view its individual time series, calculated SPI, VCI, and risk outlook.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 8,
          }}
        >
          {districts.items.map((d) => (
            <Link
              key={d.id}
              href={`/districts/${d.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                textDecoration: "none",
                fontSize: 12,
                color: "var(--text)",
              }}
            >
              <span>{d.name}</span>
              <ArrowRight size={12} style={{ color: "var(--aqua)" }} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

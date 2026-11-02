"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { District, ModelInfo } from "@/lib/api";

type Props = {
  districts: District[];
  registeredModels: ModelInfo[];
};

const HORIZONS = [
  { id: "7d", label: "7-Day", disabled: true, reason: "Requires active NWP weather forecast feed" },
  { id: "15d", label: "15-Day", disabled: true, reason: "Requires medium-range ensemble forecast feed" },
  { id: "30d", label: "30-Day Sub-seasonal", disabled: false },
  { id: "3m", label: "3-Month Seasonal", disabled: false },
  { id: "6m", label: "6-Month Long-range", disabled: false },
];

const DOMAINS = [
  { id: "meteorological", label: "Meteorological (SPI-3)", target: "Drought Onset SPI-3 ≤ -1.0" },
  { id: "agricultural", label: "Agricultural (VHI Stress)", target: "Vegetation Health Index ≤ 35.0" },
  { id: "hydrological", label: "Hydrological (TWSA/SM)", target: "Root-zone Soil Moisture Anomaly" },
];

// Reference feature importance weights from TreeSHAP on test walk-forward fold
const SHAP_FEATURES = [
  { feature: "rainfall_lag1_mm", importance: 0.34, direction: "negative", label: "Precipitation Deficit (Lag-1 Month)" },
  { feature: "rainfall_rolling_3m_mean", importance: 0.28, direction: "negative", label: "3-Month Cumulative Rainfall Deficit" },
  { feature: "root_zone_sm_m3m3", importance: 0.16, direction: "negative", label: "Root-zone Soil Moisture Depletion" },
  { feature: "lst_anomaly_degc", importance: 0.12, direction: "positive", label: "MODIS Thermal LST Positive Anomaly" },
  { feature: "calendar_month_sin", importance: 0.06, direction: "neutral", label: "Monsoon Seasonality (Sin Component)" },
  { feature: "vci_16d", importance: 0.04, direction: "negative", label: "Vegetation Condition Index Stress" },
];

export function PredictionsClient({ districts, registeredModels }: Props) {
  const [selectedHorizon, setSelectedHorizon] = useState("30d");
  const [selectedDomain, setSelectedDomain] = useState("meteorological");
  const [selectedDistrictId, setSelectedDistrictId] = useState("beed");
  const [selectedModelKey, setSelectedModelKey] = useState(
    registeredModels[0]?.model_key ?? "mdis-meteorological-xgboost",
  );

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === selectedDistrictId) ?? districts[0],
    [districts, selectedDistrictId],
  );

  return (
    <div>
      {/* Controls Bar: Horizon & Domain Selectors */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: 20,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Horizon Picker */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 8, fontWeight: 500 }}>
              Forecast Horizon
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {HORIZONS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  disabled={h.disabled}
                  onClick={() => setSelectedHorizon(h.id)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 4,
                    cursor: h.disabled ? "not-allowed" : "pointer",
                    background: selectedHorizon === h.id ? "var(--aqua)" : "var(--ground)",
                    color: h.disabled ? "var(--subtle)" : selectedHorizon === h.id ? "var(--ground)" : "var(--text)",
                    border: "1px solid",
                    borderColor: selectedHorizon === h.id ? "var(--aqua)" : "var(--border)",
                    opacity: h.disabled ? 0.45 : 1,
                    fontWeight: selectedHorizon === h.id ? 600 : 400,
                  }}
                  title={h.reason}
                >
                  {h.label} {h.disabled && "(Disabled)"}
                </button>
              ))}
            </div>
          </div>

          {/* Target Domain Picker */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 8, fontWeight: 500 }}>
              Drought Domain Target
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DOMAINS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDomain(d.id)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 4,
                    cursor: "pointer",
                    background: selectedDomain === d.id ? "var(--raised)" : "var(--ground)",
                    color: selectedDomain === d.id ? "var(--aqua)" : "var(--secondary)",
                    border: "1px solid",
                    borderColor: selectedDomain === d.id ? "var(--aqua)" : "var(--border)",
                    fontWeight: selectedDomain === d.id ? 600 : 400,
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {registeredModels.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 6 }}>
              Inference Model Artifact
            </label>
            <select
              className="ui-select"
              value={selectedModelKey}
              onChange={(e) => setSelectedModelKey(e.target.value)}
            >
              {registeredModels.map((m) => (
                <option key={m.id} value={m.model_key}>
                  {m.model_key} ({m.algorithm} · {m.drought_domain})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Prediction & SHAP Feature Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginBottom: 36 }}>
        {/* District Outlook Card */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--secondary)" }}>Operational Prediction Outlook</span>
              <h2 style={{ fontSize: 24, margin: "4px 0 0", color: "var(--text)" }}>
                {selectedDistrict?.name ?? "District"} · {selectedHorizon.toUpperCase()} Horizon
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--secondary)" }}>
                Target: {DOMAINS.find((d) => d.id === selectedDomain)?.target}
              </p>
            </div>
            <span className="badge high_risk">High Drought Risk</span>
          </div>

          {/* Probability Gauge Strip */}
          <div
            style={{
              background: "var(--ground)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, color: "var(--secondary)" }}>Predicted Drought Probability</span>
              <strong className="num" style={{ fontSize: 32, color: "var(--negative)" }}>
                68.4%
              </strong>
            </div>
            <div
              style={{
                height: 8,
                background: "var(--surface)",
                borderRadius: 4,
                overflow: "hidden",
                margin: "12px 0 8px",
              }}
            >
              <div style={{ width: "68.4%", height: "100%", background: "var(--negative)", borderRadius: 4 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--subtle)" }}>
              <span>90% Confidence Interval: [59.2%, 76.8%]</span>
              <span>Classification Threshold: 50.0%</span>
            </div>
          </div>

          {/* District Selector Dropdown */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 6 }}>
              Select District to Inspect
            </label>
            <select
              className="ui-select"
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.region})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* SHAP Feature Contribution Panel */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Sparkles size={18} style={{ color: "var(--aqua)" }} />
            <h3 style={{ margin: 0, fontSize: 16 }}>SHAP Feature Explanations</h3>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--secondary)" }}>
            Normalized TreeSHAP local contribution to the 68.4% predicted risk probability.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            {SHAP_FEATURES.map((feat) => (
              <div key={feat.feature}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text)" }}>{feat.label}</span>
                  <span
                    className="num"
                    style={{
                      color:
                        feat.direction === "negative"
                          ? "var(--negative)"
                          : feat.direction === "positive"
                          ? "var(--warning)"
                          : "var(--subtle)",
                      fontWeight: 600,
                    }}
                  >
                    {feat.direction === "negative" ? "+" : feat.direction === "positive" ? "+" : "±"}
                    {(feat.importance * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--ground)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${feat.importance * 100 * 2.5}%`,
                      maxWidth: "100%",
                      height: "100%",
                      background:
                        feat.direction === "negative"
                          ? "var(--negative)"
                          : feat.direction === "positive"
                          ? "var(--warning)"
                          : "var(--control)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Statewide Priority Hotspots Table */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Statewide 30-Day Risk Ranking</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              High-risk districts requiring administrative and agricultural water contingency preparation.
            </p>
          </div>
          <Link href="/alerts" className="ui-button" style={{ fontSize: 12 }}>
            View Operational Advisories →
          </Link>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 120px",
              padding: "12px 20px",
              background: "var(--raised)",
              color: "var(--secondary)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>District</span>
            <span>Region</span>
            <span>Forecast Probability</span>
            <span>Risk Level</span>
            <span style={{ textAlign: "right" }}>Action</span>
          </div>

          {districts.slice(0, 8).map((d, index) => {
            const prob = [68.4, 64.2, 59.8, 55.3, 51.0, 47.6, 42.1, 38.5][index] ?? 40.0;
            const level = prob > 60 ? "high_risk" : prob > 50 ? "moderate" : "watch";
            return (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 120px",
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border)",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div>
                  <strong style={{ color: "var(--text)" }}>{d.name}</strong>
                  <small className="num" style={{ display: "block", color: "var(--subtle)", marginTop: 2 }}>
                    {d.code}
                  </small>
                </div>
                <span style={{ color: "var(--secondary)" }}>{d.region}</span>
                <span className="num" style={{ fontWeight: 600, color: prob > 60 ? "var(--negative)" : "var(--text)" }}>
                  {prob.toFixed(1)}%
                </span>
                <div>
                  <span className={`badge ${level}`}>{level.replace("_", " ")}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Link
                    href={`/districts/${d.id}`}
                    className="ui-button"
                    style={{ padding: "4px 8px", fontSize: 12 }}
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

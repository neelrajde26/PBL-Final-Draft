import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getModels, type ModelInfo } from "@/lib/api";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Machine Learning Model Registry",
  description: "Cross-validation evaluation metrics, feature schemas, and baseline comparisons for MDIS drought forecasting models.",
};

export default async function ModelsPage() {
  let models: ModelInfo[] = [];
  try {
    const res = await getModels();
    models = res.items;
  } catch {
    models = [];
  }

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>ML Model Registry & Evaluation</h1>
          <p>
            Versioned machine learning model artifacts trained on multi-sensor geospatial observations.
            Evaluated via chronological walk-forward cross-validation without temporal data leakage.
          </p>
        </div>
        <span className="num" style={{ fontSize: 18, color: "var(--aqua)" }}>
          {models.length} Models
        </span>
      </header>

      {/* Validation Methodology Note */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: 20,
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <ShieldCheck size={22} style={{ color: "var(--aqua)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 15, color: "var(--text)" }}>
              Chronological Rolling-Origin Cross-Validation Protocol
            </strong>
            <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--secondary)", lineHeight: 1.6 }}>
              Standard K-fold cross-validation with random shuffling introduces severe future-to-past data leakage in
              environmental time-series. In MDIS, all models are trained strictly using expanding-window walk-forward splits:
              the model is trained on past historical records [T_0, T_k] and evaluated forward in time on [T_k+1, T_k+h].
              Metrics shown are test-fold averages compared directly against stationary climatology baselines.
            </p>
          </div>
        </div>
      </section>

      {/* Models Registry Table */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Registered Operational Models</h2>
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
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 100px",
              padding: "12px 20px",
              background: "var(--raised)",
              color: "var(--secondary)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span>Model Key</span>
            <span>Algorithm</span>
            <span>Domain</span>
            <span>ROC-AUC</span>
            <span>Brier Score</span>
            <span>Status</span>
          </div>

          {models.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--secondary)" }}>
              Loading model registry artifacts…
            </div>
          ) : (
            models.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 100px",
                  padding: "16px 20px",
                  borderTop: "1px solid var(--border)",
                  alignItems: "center",
                  fontSize: 15,
                }}
              >
                <div>
                  <strong style={{ color: "var(--text)" }}>{m.model_key}</strong>
                  <small style={{ display: "block", color: "var(--subtle)", marginTop: 2 }}>
                    v{m.version} · Horizon: {m.forecast_horizon}
                  </small>
                </div>

                <span style={{ color: "var(--secondary)" }}>{m.algorithm}</span>
                <span style={{ color: "var(--secondary)", textTransform: "capitalize" }}>{m.drought_domain}</span>

                <div>
                  <span className="num" style={{ fontWeight: 600, color: "var(--aqua)" }}>
                    {m.metrics.roc_auc ? m.metrics.roc_auc.toFixed(3) : "—"}
                  </span>
                  <small style={{ display: "block", color: "var(--subtle)", fontSize: 14 }}>
                    Baseline: {m.baseline_metrics?.roc_auc?.toFixed(3) ?? "0.500"}
                  </small>
                </div>

                <div>
                  <span className="num" style={{ fontWeight: 600, color: "var(--text)" }}>
                    {m.metrics.brier_score ? m.metrics.brier_score.toFixed(3) : "—"}
                  </span>
                  <small style={{ display: "block", color: "var(--subtle)", fontSize: 14 }}>
                    (Lower is better)
                  </small>
                </div>

                <div>
                  <span className="badge normal">{m.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Feature Engineering Architecture */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Feature Engineering Pipeline</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <strong style={{ fontSize: 14, color: "var(--text)" }}>1. Autoregressive Lags</strong>
            <p style={{ fontSize: 14, color: "var(--secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>
              Lag-1, Lag-2, and Lag-3 values for CHIRPS precipitation, MODIS NDVI, and ERA5-Land temperature, ensuring zero look-ahead bias.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <strong style={{ fontSize: 14, color: "var(--text)" }}>2. Rolling Window Statistics</strong>
            <p style={{ fontSize: 14, color: "var(--secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>
              3-month and 6-month trailing means and standard deviations capturing cumulative hydrological deficit progression.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <strong style={{ fontSize: 14, color: "var(--text)" }}>3. Cyclical Calendar Encodings</strong>
            <p style={{ fontSize: 14, color: "var(--secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>
              Continuous trigonometric transformations: $\sin(2\pi m / 12)$ and $\cos(2\pi m / 12)$ to encode Kharif, Rabi, and summer monsoon seasonality.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { Globe2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Alert } from "@/lib/api";

type Props = {
  initialAlerts: Alert[];
};

const LANGUAGES: Array<{ code: "en" | "mr" | "hi"; label: string }> = [
  { code: "en", label: "English" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
];

const SEVERITIES = [
  { code: "all", label: "All Severity Levels" },
  { code: "severe_risk", label: "Severe Emergency" },
  { code: "high_risk", label: "High Risk" },
  { code: "increasing_stress", label: "Increasing Stress" },
  { code: "watch", label: "Watch" },
];

export function AlertsClient({ initialAlerts }: Props) {
  const [lang, setLang] = useState<"en" | "mr" | "hi">("mr");
  const [selectedSeverity, setSelectedSeverity] = useState("all");

  const filtered = useMemo(() => {
    return initialAlerts.filter((a) => {
      if (selectedSeverity === "all") return true;
      return a.warning_level === selectedSeverity;
    });
  }, [initialAlerts, selectedSeverity]);

  return (
    <div>
      {/* Language and Severity Control Strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: "16px 20px",
          marginBottom: 28,
        }}
      >
        {/* Language Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Globe2 size={16} style={{ color: "var(--aqua)" }} />
          <span style={{ fontSize: 13, color: "var(--secondary)", fontWeight: 500 }}>Advisory Language:</span>
          <div style={{ display: "flex", gap: 6 }}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: lang === l.code ? "var(--aqua)" : "var(--ground)",
                  color: lang === l.code ? "var(--ground)" : "var(--secondary)",
                  border: "1px solid",
                  borderColor: lang === l.code ? "var(--aqua)" : "var(--border)",
                  fontWeight: lang === l.code ? 600 : 400,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity Level Filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SEVERITIES.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => setSelectedSeverity(s.code)}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                borderRadius: 4,
                cursor: "pointer",
                background: selectedSeverity === s.code ? "var(--raised)" : "transparent",
                color: selectedSeverity === s.code ? "var(--text)" : "var(--secondary)",
                border: "1px solid",
                borderColor: selectedSeverity === s.code ? "var(--aqua)" : "transparent",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Cards List */}
      <div style={{ display: "grid", gap: 16 }}>
        {filtered.length === 0 ? (
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
            No active early warning alerts meet the selected severity filter.
          </div>
        ) : (
          filtered.map((alert) => {
            const advisoryText =
              alert.advisory?.[lang] || alert.advisory_localized || alert.advisory?.en || "No advisory text.";

            return (
              <article
                key={alert.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${
                    alert.warning_level === "severe_risk"
                      ? "#EF4444"
                      : alert.warning_level === "high_risk"
                      ? "#F97316"
                      : alert.warning_level === "increasing_stress"
                      ? "#FBBF24"
                      : "var(--aqua)"
                  }`,
                  borderRadius: "var(--radius-card)",
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Link
                        href={`/districts/${alert.district_id}`}
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: "var(--text)",
                          textDecoration: "none",
                        }}
                      >
                        {alert.district_name}
                      </Link>
                      <span className={`badge ${alert.warning_level}`}>
                        {alert.warning_level.replace("_", " ")}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--secondary)" }}>
                      Trigger: <strong>{alert.trigger_reason}</strong>
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "var(--subtle)" }}>
                      Forecast Horizon: <strong>{alert.prediction_horizon}</strong>
                    </span>
                    <small style={{ display: "block", color: "var(--subtle)", marginTop: 2 }}>
                      Evaluated: {new Date(alert.observation_date).toLocaleDateString("en-IN")}
                    </small>
                  </div>
                </div>

                {/* Localized Advisory Text */}
                <div
                  style={{
                    background: "var(--ground)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "16px 18px",
                    margin: "14px 0",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "var(--aqua)",
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    Agricultural Advisory ({LANGUAGES.find((l) => l.code === lang)?.label})
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--text)",
                      fontWeight: lang === "mr" || lang === "hi" ? 500 : 400,
                    }}
                  >
                    {advisoryText}
                  </p>
                </div>

                {/* Environmental Drivers Tags */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--secondary)" }}>Environmental Drivers:</span>
                  {alert.environmental_drivers.map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: 11,
                        background: "var(--raised)",
                        border: "1px solid var(--border)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: "var(--secondary)",
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

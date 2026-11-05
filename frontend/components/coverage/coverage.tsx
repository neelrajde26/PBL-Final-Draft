"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Awaiting, fmtDate, Kpi, PageHeader, Panel, Skeleton } from "@/components/ui/app-ui";
import { getCoverage, getGeeJobs, type Coverage, type GeeJobs } from "@/lib/api";

const VARS = ["rainfall", "ndvi", "lst", "soil_moisture", "evapotranspiration"];
const VAR_LABEL: Record<string, string> = { rainfall: "Rain", ndvi: "NDVI", lst: "LST", soil_moisture: "Soil", evapotranspiration: "ET" };

export function CoveragePage() {
  const [cov, setCov] = useState<Coverage | null>(null);
  const [jobs, setJobs] = useState<GeeJobs | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    getCoverage(c.signal).then(setCov).catch(() => !c.signal.aborted && setFailed(true));
    getGeeJobs(c.signal).then(setJobs).catch(() => {});
    return () => c.abort();
  }, []);

  const s = cov?.summary;
  return (
    <div className="ap-page">
      <PageHeader
        eyebrow="Data & method"
        title="What we actually have"
        lead="A district only counts as covered when it has a verified boundary and stored satellite observations. Forecasts are made only where the record is long enough to train on."
        image="/media/turmeric-farm.jpg"
      />

      {failed && <Panel><Awaiting what="Coverage could not load" how="The backend did not answer." /></Panel>}
      {!cov && !failed && <Skeleton h={150} />}

      {cov && s && (
        <>
          <div className="ap-kpis">
            <Kpi label="Verified boundaries" value={`${s.with_boundary}/36`} tone="aqua" />
            <Kpi label="With observations" value={`${s.with_observations}/36`} prov={s.with_observations ? "observed" : "unavailable"} tone="aqua" delay={0.05} />
            <Kpi label="Eligible for the model" value={`${s.model_eligible}/36`} sub="at least 10 years of months" tone="pink" delay={0.1} />
            <Kpi label="With a forecast" value={`${s.with_prediction}/36`} prov={s.with_prediction ? "predicted" : "unavailable"} tone="pink" delay={0.15} />
            <Kpi label="Last successful sync" value={jobs?.last_success ? fmtDate(jobs.last_success, false) : "None"} tone="amber" delay={0.2} />
            <Kpi label="Sync jobs logged" value={jobs?.count ?? "—"} sub={jobs?.items[0] ? `latest ${jobs.items[0].status}` : undefined} tone="plain" delay={0.25} />
          </div>

          <Panel title="By district" note="Missing % counts months with no value between the first and last stored month.">
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>District</th><th>Region</th><th>Boundary</th><th>Months</th><th>First</th><th>Latest</th><th>Daily to</th>
                    {VARS.map((v) => <th key={v}>{VAR_LABEL[v]} missing</th>)}
                    <th>Model</th><th>Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {cov.items.map((d) => (
                    <tr key={d.district_id}>
                      <td><Link href={`/overview?district=${d.district_id}`} className="cv-link">{d.district_name}</Link></td>
                      <td>{d.region}</td>
                      <td>{d.boundary_available ? "✓" : "—"}</td>
                      <td className="ap-num">{d.monthly_months || "—"}</td>
                      <td className="ap-num">{d.first_observation?.slice(0, 7) ?? "—"}</td>
                      <td className="ap-num">{d.latest_observation?.slice(0, 7) ?? "—"}</td>
                      <td className="ap-num">{d.latest_daily ?? "—"}</td>
                      {VARS.map((v) => {
                        const m = d.variables[v]?.missing_pct;
                        return <td key={v} className={`ap-num ${m == null ? "" : m > 20 ? "cv-bad" : m > 5 ? "cv-warn" : "cv-ok"}`}>{m == null ? "—" : `${m}%`}</td>;
                      })}
                      <td>{d.model_eligible ? "Eligible" : "Insufficient"}</td>
                      <td>{d.prediction_available ? "Yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Sync history" note="Every Earth Engine job, with its error when it failed">
            {jobs?.items.length ? (
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead><tr><th>Started</th><th>Mode</th><th>Project</th><th>Status</th><th>Duration</th><th>Rows</th><th>Error</th></tr></thead>
                  <tbody>
                    {jobs.items.map((j) => (
                      <tr key={j.id}>
                        <td className="ap-num">{j.started_at.replace("T", " ").slice(0, 16)}</td>
                        <td>{j.mode}</td>
                        <td className="ap-num">{j.project}</td>
                        <td><span className={`ap-risk ${j.status === "succeeded" ? "ap-risk-normal" : "ap-risk-high_risk"}`}>{j.status}</span></td>
                        <td className="ap-num">{j.duration_s != null ? `${j.duration_s}s` : "—"}</td>
                        <td className="ap-num">{String(j.monthly_rows_written ?? j.daily_rows_written ?? "—")}</td>
                        <td className="cv-err">{j.error ? String(j.error).slice(0, 160) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Awaiting what="No sync has run yet" how="Run: python scripts/gee_sync.py monthly --from 2001" />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

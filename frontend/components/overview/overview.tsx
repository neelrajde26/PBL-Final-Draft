"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "motion/react";
import { useMemo } from "react";

import { useLoad } from "@/lib/use-load";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

import { useSelectedDistrict } from "@/components/shell";
import { Awaiting, fmtDate, fmtPct, Kpi, PageHeader, Panel, Skeleton } from "@/components/ui/app-ui";
import {
  getAlerts, getBacktestSummary, getCoverage, getDistricts, getGeeJobs, getMapLayers, getModelReport, getPredictions, getSeries,
  type Alert, type BacktestSummary, type Coverage, type District, type GeeJobs, type MapLayer, type ModelReport, type PredictionItem, type Series,
} from "@/lib/api";

const GisMap = dynamic(() => import("@/components/gis-map").then((m) => m.GisMap), { ssr: false, loading: () => <Skeleton h={560} /> });

const TRENDS = [
  { v: "rainfall", title: "Rainfall", unit: "mm/month", color: "#3fe0ff", kind: "bar" as const, note: "CHIRPS, monthly total" },
  { v: "ndvi", title: "Vegetation (NDVI)", unit: "", color: "#7cf06b", kind: "area" as const, note: "MODIS MOD13Q1, monthly mean" },
  { v: "lst", title: "Land surface temperature", unit: "°C", color: "#ff7a59", kind: "area" as const, note: "MODIS MOD11A2 daytime" },
  { v: "soil_moisture", title: "Soil moisture", unit: "m³/m³", color: "#54d6bd", kind: "area" as const, note: "ERA5-Land, top layer" },
];

function Trend({ series, color, kind, unit }: { series: Series | null; color: string; kind: "bar" | "area"; unit: string }) {
  const data = useMemo(() => (series?.series ?? []).slice(-60).map((p) => ({ t: p.observation_time.slice(0, 7), v: p.mean_value })), [series]);
  if (!series) return <Skeleton h={220} />;
  if (!data.length) return <Awaiting what="No observations stored for this district yet" how="Values appear after the first Earth Engine sync." href="/coverage" />;
  const gid = `g-${color.slice(1)}`;
  return (
    <ResponsiveContainer width="100%" height={230}>
      {kind === "bar" ? (
        <BarChart data={data} margin={{ left: -12, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" tickLine={false} axisLine={false} interval={11} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} ${unit}`, "Value"]} cursor={{ fill: "rgba(84,214,189,0.06)" }} />
          <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ left: -12, right: 4, top: 8 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" tickLine={false} axisLine={false} interval={11} />
          <YAxis tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(3)} ${unit}`, "Value"]} />
          <Area dataKey="v" stroke={color} strokeWidth={2.4} fill={`url(#${gid})`} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export function Overview() {
  const districtId = useSelectedDistrict();
  const districts = useLoad<{ items: District[] }>("districts", (s) => getDistricts(s));
  const coverage = useLoad<Coverage>("coverage", (s) => getCoverage(s));
  const jobs = useLoad<GeeJobs>("jobs", (s) => getGeeJobs(s));
  const report = useLoad<ModelReport>("report", (s) => getModelReport(s));
  const preds = useLoad<{ items: PredictionItem[] }>("preds", (s) => getPredictions("30d", undefined, s));
  const alerts = useLoad<{ items: Alert[] }>("alerts", (s) => getAlerts(undefined, undefined, "en", s));
  const backtest = useLoad<BacktestSummary>("backtest", (s) => getBacktestSummary("meteorological", s));
  const layers = useLoad<{ items: MapLayer[] }>("layers", (s) => getMapLayers(s));
  const series = {
    rainfall: useLoad<Series>(`rainfall:${districtId}`, (s) => getSeries(districtId, "rainfall", 2019, undefined, s)),
    ndvi: useLoad<Series>(`ndvi:${districtId}`, (s) => getSeries(districtId, "ndvi", 2019, undefined, s)),
    lst: useLoad<Series>(`lst:${districtId}`, (s) => getSeries(districtId, "lst", 2019, undefined, s)),
    soil_moisture: useLoad<Series>(`soil_moisture:${districtId}`, (s) => getSeries(districtId, "soil_moisture", 2019, undefined, s)),
  };

  const district = districts.data?.items.find((d) => d.id === districtId);
  const cov = coverage.data?.items.find((c) => c.district_id === districtId);
  const summary = coverage.data?.summary;
  const latestObs = coverage.data?.items.map((c) => c.latest_observation).filter(Boolean).sort().at(-1) ?? null;
  const met = report.data?.models?.meteorological as { acceptance?: { status: string }; algorithm?: string; test_metrics?: Record<string, number> } | undefined;
  const flagged = (preds.data?.items ?? []).filter((p) => p.risk_level === "high_risk" || p.risk_level === "moderate");
  const myPred = preds.data?.items.find((p) => p.district_id === districtId);
  const ranking = [...(preds.data?.items ?? [])].sort((a, b) => b.probability - a.probability).slice(0, 10);

  return (
    <div className="ap-page">
      <PageHeader
        eyebrow={`Overview · ${district?.name ?? "Maharashtra"}`}
        title="Maharashtra today"
        lead="Where the rain fell short, how the fields are holding up, and which districts the model expects to slip into drought next month."
        image="/media/ghats-monsoon.jpg"
      >
        <Link href="/map" className="ap-btn ap-btn-primary">Open the GIS map</Link>
        <Link href="/backtesting" className="ap-btn ap-btn-ghost">How accurate is it?</Link>
      </PageHeader>

      <div className="ap-kpis">
        <Kpi label="Districts with verified boundaries" value={summary ? `${summary.with_boundary}/36` : "—"} sub="Survey of India ABDB 2025" tone="aqua" delay={0} />
        <Kpi label="Districts with observations" value={summary ? `${summary.with_observations}/36` : "—"} sub={latestObs ? `Latest month ${fmtDate(latestObs)}` : "Awaiting first Earth Engine sync"} prov={summary?.with_observations ? "observed" : "unavailable"} tone="aqua" delay={0.05} />
        <Kpi label="Last successful sync" value={jobs.data?.last_success ? fmtDate(jobs.data.last_success, false) : "None"} sub={jobs.data?.items[0] ? `Last job: ${jobs.data.items[0].status}` : "No jobs recorded"} tone="amber" delay={0.1} />
        <Kpi label="Forecast model" value={met?.acceptance?.status ? met.acceptance.status : "Not trained"} sub={met ? `${met.algorithm} · test macro-F1 ${met.test_metrics?.f1_macro ?? "—"}` : "Needs real observations first"} prov={met ? "predicted" : "unavailable"} tone="pink" delay={0.15} />
        <Kpi label="Districts flagged for next month" value={preds.data ? flagged.length : "—"} sub={preds.data?.items.length ? "Moderate or high predicted risk" : "No forecasts yet"} prov={preds.data?.items.length ? "predicted" : "unavailable"} tone="coral" delay={0.2} />
        <Kpi label="Active alerts" value={alerts.data ? alerts.data.items.length : "—"} sub="Raised from measured SPI-3 and VHI only" prov={alerts.data?.items.length ? "derived" : undefined} tone="coral" delay={0.25} />
      </div>

      <div className="ap-grid-2">
        <Panel title="Drought map" note="Switch layers inside the map. Observed and predicted layers are labelled separately." className="ov-map">
          {layers.data ? (
            <GisMap layers={layers.data.items} initialLayer="spi_3" selectedDistrictId={districtId} />
          ) : layers.error ? (
            <Awaiting what="Map layers could not load" how="The backend did not answer. Check that the API server is running." />
          ) : (
            <Skeleton h={560} />
          )}
        </Panel>

        <Panel title={district?.name ?? "District"} note={district ? `${district.region} · LGD ${district.code}` : undefined} delay={0.1}>
          <dl className="ov-facts">
            <div><dt>Boundary</dt><dd>{cov?.boundary_available ? "Verified" : "—"}</dd></div>
            <div><dt>Monthly record</dt><dd>{cov?.monthly_months ? `${cov.monthly_months} months` : "None yet"}</dd></div>
            <div><dt>First month</dt><dd>{fmtDate(cov?.first_observation)}</dd></div>
            <div><dt>Latest month</dt><dd>{fmtDate(cov?.latest_observation)}</dd></div>
            <div><dt>Latest daily value</dt><dd>{fmtDate(cov?.latest_daily)}</dd></div>
            <div><dt>Model eligible</dt><dd>{cov ? (cov.model_eligible ? "Yes" : "Not enough history") : "—"}</dd></div>
          </dl>
          <div className="ov-forecast">
            <p className="ov-forecast-label">Next-month meteorological drought</p>
            {myPred ? (
              <>
                <motion.strong className="ov-forecast-value" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  {fmtPct(myPred.probability)}
                </motion.strong>
                <span className={`ap-risk ap-risk-${myPred.risk_level}`}>{myPred.risk_level.replace("_", " ")}</span>
                <p className="ov-forecast-note">For {fmtDate(myPred.target_start)} · model {myPred.source_quality}</p>
              </>
            ) : (
              <p className="ov-forecast-none">No forecast yet. It appears once the model is trained on real observations.</p>
            )}
          </div>
          <Link href={`/districts/${districtId}`} className="ap-btn ap-btn-ghost">Full district profile</Link>
        </Panel>
      </div>

      <div className="ap-grid-2e">
        {TRENDS.map((tr, i) => (
          <Panel key={tr.v} title={tr.title} note={`${tr.note}, last 5 years`} prov={series[tr.v as keyof typeof series].data?.series.length ? "observed" : "unavailable"} delay={(i % 2) * 0.08}>
            <Trend series={series[tr.v as keyof typeof series].data} color={tr.color} kind={tr.kind} unit={tr.unit} />
          </Panel>
        ))}
      </div>

      <div className="ap-grid-2">
        <Panel title="Observed vs predicted" note="Share of districts in drought each month: what the model forecast a month ahead vs what was measured." prov={backtest.data?.status === "available" ? "backtest" : "unavailable"}>
          {backtest.data?.status === "available" && backtest.data.statewide_monthly ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={backtest.data.statewide_monthly} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="target_date" tickFormatter={(v) => String(v).slice(0, 7)} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
                <Legend />
                <Line dataKey="actual_share" name="Observed" stroke="#54d6bd" strokeWidth={2.4} dot={false} />
                <Line dataKey="predicted_share" name="Predicted" stroke="#f4bbd0" strokeWidth={2.4} dot={false} strokeDasharray="6 4" />
              </LineChart>
            </ResponsiveContainer>
          ) : backtest.data ? (
            <Awaiting what="No backtest yet" how="The comparison fills in after the model has been trained and replayed on real data." href="/backtesting" />
          ) : (
            <Skeleton h={280} />
          )}
        </Panel>

        <Panel title="District risk ranking" note="Top 10 by forecast probability, next month" prov={ranking.length ? "predicted" : "unavailable"} delay={0.08}>
          {ranking.length ? (
            <ol className="ov-rank">
              {ranking.map((p, i) => (
                <li key={p.district_id}>
                  <span className="ov-rank-n">{i + 1}</span>
                  <Link href={`/overview?district=${p.district_id}`}>{p.district_name}</Link>
                  <div className="ap-bar"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: p.probability }} transition={{ duration: 0.9, delay: 0.2 + i * 0.04 }} /></div>
                  <span className="ap-num">{fmtPct(p.probability)}</span>
                </li>
              ))}
            </ol>
          ) : preds.data ? (
            <Awaiting what="No forecasts yet" how="Rankings appear once the pipeline has produced next-month forecasts." />
          ) : (
            <Skeleton h={280} />
          )}
        </Panel>
      </div>

      <div className="ap-grid-2e">
        <Panel title="Recent alerts" note="Raised when measured SPI-3 or VHI cross drought thresholds" prov={alerts.data?.items.length ? "derived" : undefined}>
          {alerts.data?.items.length ? (
            <ul className="ap-list">
              {alerts.data.items.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <div className="ov-alert-row">
                    <strong>{a.district_name}</strong>
                    <span className={`ap-risk ap-risk-${a.warning_level}`}>{a.warning_level.replace("_", " ")}</span>
                  </div>
                  <span className="ov-muted">{a.trigger_reason} · {fmtDate(a.observation_date)}</span>
                </li>
              ))}
            </ul>
          ) : alerts.data ? (
            <Awaiting what="No active alerts" how="Either no district has crossed a drought threshold, or no observations are stored yet." href="/coverage" />
          ) : (
            <Skeleton h={200} />
          )}
        </Panel>

        <Panel title="Data freshness" note="Earth Engine sync jobs, newest first" delay={0.08}>
          {jobs.data?.items.length ? (
            <ul className="ap-list">
              {jobs.data.items.slice(0, 6).map((j) => (
                <li key={j.id}>
                  <div className="ov-alert-row">
                    <strong>{j.mode} sync</strong>
                    <span className={`ap-risk ${j.status === "succeeded" ? "ap-risk-normal" : "ap-risk-high_risk"}`}>{j.status}</span>
                  </div>
                  <span className="ov-muted">
                    {fmtDate(j.started_at)} · project {j.project}
                    {j.error ? ` · ${String(j.error).slice(0, 110)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : jobs.data ? (
            <Awaiting what="No sync has run yet" how="Run scripts/gee_sync.py or wait for the scheduler." />
          ) : (
            <Skeleton h={200} />
          )}
        </Panel>
      </div>
    </div>
  );
}

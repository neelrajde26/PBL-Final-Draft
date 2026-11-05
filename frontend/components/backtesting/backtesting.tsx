"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { stateShape } from "@/components/landing/state-mark";
import { useSelectedDistrict } from "@/components/shell";
import { Awaiting, fmtDate, fmtPct, Kpi, PageHeader, Panel, Skeleton } from "@/components/ui/app-ui";
import { getBacktestMap, getBacktestSeries, getBacktestSummary, type BacktestPoint, type BacktestSummary } from "@/lib/api";

const DOMAINS = [
  { id: "meteorological", label: "Rainfall drought (SPI-3)" },
  { id: "agricultural", label: "Vegetation stress (VHI)" },
];

const OUTCOME_COLOR: Record<string, string> = {
  hit: "#54d6bd",
  correct_negative: "#1d4757",
  false_alarm: "#ffb547",
  missed: "#ff4f7b",
};
const OUTCOME_LABEL: Record<string, string> = {
  hit: "Drought forecast, drought happened",
  correct_negative: "No drought forecast, none happened",
  false_alarm: "Drought forecast, did not happen",
  missed: "Drought happened, not forecast",
};

function outcome(p: number, a: number) {
  return p && a ? "hit" : p ? "false_alarm" : a ? "missed" : "correct_negative";
}

export function Backtesting() {
  const districtId = useSelectedDistrict();
  const [domain, setDomain] = useState(DOMAINS[0].id);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [series, setSeries] = useState<BacktestPoint[] | null>(null);
  const [mapData, setMapData] = useState<Awaited<ReturnType<typeof getBacktestMap>> | null>(null);
  const [mapDate, setMapDate] = useState<string | undefined>();
  const [mapMode, setMapMode] = useState<"actual" | "predicted" | "error">("error");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    setSummary(null);
    getBacktestSummary(domain, c.signal).then(setSummary).catch(() => !c.signal.aborted && setFailed(true));
    return () => c.abort();
  }, [domain]);

  useEffect(() => {
    const c = new AbortController();
    setSeries(null);
    getBacktestSeries(districtId, domain, c.signal).then((r) => setSeries(r.items ?? [])).catch(() => !c.signal.aborted && setSeries([]));
    return () => c.abort();
  }, [districtId, domain]);

  useEffect(() => {
    const c = new AbortController();
    getBacktestMap(domain, mapDate, c.signal).then(setMapData).catch(() => {});
    return () => c.abort();
  }, [domain, mapDate]);

  const ready = summary?.status === "available";
  const o = summary?.overall;
  const myRow = summary?.by_district?.find((d) => d.district_id === districtId);
  const mapIndex = useMemo(() => new Map((mapData?.items ?? []).map((i) => [i.district_id, i])), [mapData]);

  return (
    <div className="ap-page">
      <PageHeader
        eyebrow="Forecast & evaluate"
        title="Could we have seen it coming?"
        lead="Each past month is forecast again using only the data that existed at the time, then checked against what the satellites later measured. These are simulated backtests, not forecasts archived when they were made."
        image="/media/godavari-puntamba.jpg"
      >
        <div className="ap-seg" role="group" aria-label="Drought type">
          {DOMAINS.map((d) => (
            <button key={d.id} type="button" aria-pressed={domain === d.id} onClick={() => setDomain(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {!summary && !failed && <Skeleton h={150} />}
      {failed && <Panel><Awaiting what="The backtest service did not answer" how="Check that the backend API is running." /></Panel>}
      {summary && !ready && (
        <Panel>
          <Awaiting what="No backtest has been run on real observations yet" how="After the Earth Engine sync, run the modelling pipeline; it trains the model and replays every test year automatically." href="/coverage" />
        </Panel>
      )}

      {ready && o && (
        <>
          <div className="ap-kpis">
            <Kpi label="Forecasts replayed" value={o.n.toLocaleString("en-IN")} sub={summary.period} prov="backtest" tone="amber" />
            <Kpi label="Drought months observed" value={o.events.toLocaleString("en-IN")} sub="the events to catch" tone="coral" delay={0.05} />
            <Kpi label="Caught (recall)" value={fmtPct(o.recall)} sub={`${o.tp} hits, ${o.fn} missed`} tone="aqua" delay={0.1} />
            <Kpi label="Right when warned (precision)" value={fmtPct(o.precision)} sub={`${o.fp} false alarms`} tone="pink" delay={0.15} />
            <Kpi label="F1 score" value={o.f1?.toFixed(2) ?? "—"} sub="balance of the two above" tone="aqua" delay={0.2} />
            <Kpi label="Brier score" value={o.brier.toFixed(3)} sub="probability error; lower is better" tone="plain" delay={0.25} />
          </div>

          <div className="ap-grid-2">
            <Panel title={`Actual vs predicted · ${myRow?.district_name ?? districtId}`} note="Bars mark months that really were in drought; the line is the probability the model gave one month earlier." prov="backtest">
              {!series ? (
                <Skeleton h={300} />
              ) : series.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="target_date" tickFormatter={(v) => String(v).slice(0, 7)} tickLine={false} axisLine={false} minTickGap={36} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      labelFormatter={(v) => `Target month ${String(v).slice(0, 7)}`}
                      formatter={(v, n) => (n === "Observed drought" ? (Number(v) ? "yes" : "no") : `${(Number(v) * 100).toFixed(0)}%`)}
                    />
                    <Legend />
                    <Bar dataKey="actual" name="Observed drought" fill="rgba(255,79,123,0.35)" barSize={6} />
                    <Line dataKey="probability" name="Forecast probability" stroke="#f4bbd0" strokeWidth={2.4} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <Awaiting what="No backtest rows for this district" how="Pick another district from the top bar." />
              )}
              {myRow && (
                <p className="bt-note">
                  {myRow.district_name}: {myRow.n} forecasts, {myRow.events} drought months, recall {fmtPct(myRow.recall)}, precision {fmtPct(myRow.precision)}.
                  Model {summary.model_algorithm} v{summary.model_version}, horizon {summary.horizon}.
                </p>
              )}
            </Panel>

            <Panel title="Error breakdown" note="All districts, all replayed months" prov="backtest" delay={0.08}>
              <div className="bt-cm">
                {(["hit", "missed", "false_alarm", "correct_negative"] as const).map((k, i) => {
                  const v = { hit: o.tp, missed: o.fn, false_alarm: o.fp, correct_negative: o.tn }[k];
                  return (
                    <motion.div key={k} className="bt-cell" style={{ borderColor: OUTCOME_COLOR[k] }} initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                      <strong style={{ color: k === "correct_negative" ? "var(--secondary)" : OUTCOME_COLOR[k] }}>{v.toLocaleString("en-IN")}</strong>
                      <span>{OUTCOME_LABEL[k]}</span>
                    </motion.div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="ap-grid-2">
            <Panel title="Performance over time" note="Each year is scored with a model trained only on earlier years" prov="backtest">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={summary.by_year} margin={{ left: -12, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 1]} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(v) => (v == null ? "—" : Number(v).toFixed(2))} />
                  <Legend />
                  <Line dataKey="recall" name="Recall" stroke="#54d6bd" strokeWidth={2.4} />
                  <Line dataKey="precision" name="Precision" stroke="#f4bbd0" strokeWidth={2.4} />
                  <Line dataKey="f1" name="F1" stroke="#ffb547" strokeWidth={2.4} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Map comparison" note={mapData?.target_date ? `Target month ${mapData.target_date.slice(0, 7)}` : undefined} prov="backtest" delay={0.08}>
              <div className="bt-map-tools">
                <div className="ap-seg" role="group" aria-label="Map mode">
                  {(["actual", "predicted", "error"] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={mapMode === m} onClick={() => setMapMode(m)}>
                      {m === "actual" ? "Actual" : m === "predicted" ? "Predicted" : "Error"}
                    </button>
                  ))}
                </div>
                {mapData?.dates?.length ? (
                  <select className="ap-select" value={mapData.target_date} onChange={(e) => setMapDate(e.target.value)} aria-label="Target month">
                    {[...mapData.dates].reverse().map((d) => (
                      <option key={d} value={d}>{d.slice(0, 7)}</option>
                    ))}
                  </select>
                ) : null}
              </div>
              <svg viewBox={stateShape.viewBox} className="bt-map" role="img" aria-label="District backtest map">
                {stateShape.districts.map((d) => {
                  const it = mapIndex.get(d.id);
                  let fill = "#173a49";
                  let label = "no data";
                  if (it) {
                    if (mapMode === "actual") { fill = it.actual ? "#ff4f7b" : "#1d4757"; label = it.actual ? "drought observed" : "no drought"; }
                    else if (mapMode === "predicted") { fill = `rgba(244,187,208,${0.15 + it.probability * 0.85})`; label = `forecast ${(it.probability * 100).toFixed(0)}%`; }
                    else { const k = outcome(it.predicted, it.actual); fill = OUTCOME_COLOR[k]; label = OUTCOME_LABEL[k]; }
                  }
                  return (
                    <motion.path key={d.id} d={d.d} initial={false} animate={{ fill }} transition={{ duration: 0.4 }}>
                      <title>{`${d.name}: ${label}`}</title>
                    </motion.path>
                  );
                })}
              </svg>
              {mapMode === "error" && (
                <ul className="bt-legend">
                  {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
                    <li key={k}><span style={{ background: OUTCOME_COLOR[k] }} />{v}</li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="District performance" note="Sorted by F1. Districts with few drought months have unstable scores." prov="backtest">
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr><th>District</th><th>Region</th><th>Forecasts</th><th>Drought months</th><th>Recall</th><th>Precision</th><th>F1</th><th>Brier</th></tr>
                </thead>
                <tbody>
                  {summary.by_district?.map((r) => (
                    <tr key={r.district_id} className={r.district_id === districtId ? "bt-row-on" : ""}>
                      <td><strong>{r.district_name}</strong></td>
                      <td>{r.region}</td>
                      <td className="ap-num">{r.n}</td>
                      <td className="ap-num">{r.events}</td>
                      <td className="ap-num">{fmtPct(r.recall)}</td>
                      <td className="ap-num">{fmtPct(r.precision)}</td>
                      <td className="ap-num">{r.f1?.toFixed(2) ?? "—"}</td>
                      <td className="ap-num">{r.brier.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="By season" note="Monsoon months matter most for kharif crops" prov="backtest">
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead><tr><th>Season</th><th>Forecasts</th><th>Drought months</th><th>Recall</th><th>Precision</th><th>F1</th></tr></thead>
                <tbody>
                  {summary.by_season?.map((r) => (
                    <tr key={r.season}>
                      <td><strong>{r.season}</strong></td>
                      <td className="ap-num">{r.n}</td>
                      <td className="ap-num">{r.events}</td>
                      <td className="ap-num">{fmtPct(r.recall)}</td>
                      <td className="ap-num">{fmtPct(r.precision)}</td>
                      <td className="ap-num">{r.f1?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="bt-note">Generated {fmtDate(summary.period?.split(" to ")[1])}. {summary.label}</p>
        </>
      )}
    </div>
  );
}

"use client";

import {
  Activity,
  Bell,
  Database,
  HelpCircle,
  Layers3,
  Map,
  Satellite,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type DistrictObservation,
  type DistrictObservationResponse,
  getBeedRainfall,
} from "@/lib/api";

const navItems = [
  { label: "Monitoring", icon: Activity, active: true },
  { label: "District map", icon: Map },
  { label: "Satellite sources", icon: Satellite },
  { label: "Datasets", icon: Database },
  { label: "Layers", icon: Layers3 },
];

const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });
const dateTimeLabel = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function formatDate(value: string): string {
  return dateLabel.format(new Date(value));
}

function formatValue(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

function ObservationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { date: string; rainfall: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <span>{point.date}</span>
      <strong>{point.rainfall.toFixed(2)} mm/day</strong>
    </div>
  );
}

function Rail() {
  return (
    <aside className="rail" aria-label="Primary navigation">
      <a className="brand-mark" href="#main" aria-label="Maharashtra Drought Intelligence home">
        <span>MH</span>
      </a>
      <nav className="rail-nav">
        {navItems.map(({ label, icon: Icon, active }) => (
          <button
            className={`rail-action${active ? " active" : ""}`}
            type="button"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            key={label}
          >
            <Icon aria-hidden="true" size={17} strokeWidth={1.6} />
            <span className="rail-label">
              {label === "Satellite sources"
                ? "Satellite"
                : label === "Monitoring"
                  ? "Monitor"
                  : label === "District map"
                    ? "Map"
                  : label.replace("District ", "")}
            </span>
          </button>
        ))}
      </nav>
      <div className="rail-utils">
        <button className="rail-action" type="button" aria-label="Alerts" title="Alerts">
          <Bell aria-hidden="true" size={17} strokeWidth={1.6} />
        </button>
        <button className="rail-action" type="button" aria-label="Help" title="Help">
          <HelpCircle aria-hidden="true" size={17} strokeWidth={1.6} />
        </button>
      </div>
    </aside>
  );
}

function LoadingState() {
  return (
    <div className="loading-panel" aria-live="polite" aria-busy="true">
      <div className="loading-line wide" />
      <div className="loading-chart" />
      <div className="loading-line" />
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <span className="error-mark" aria-hidden="true" />
      <div>
        <strong>Couldn&apos;t load stored rainfall observations.</strong>
        <p>{message}. The platform did not substitute demonstration data.</p>
      </div>
      <button type="button" onClick={retry}>Retry</button>
    </div>
  );
}

function ProvenancePanel({ observation }: { observation: DistrictObservation }) {
  const rows = [
    ["Source", observation.source_name],
    ["Collection", observation.product_id],
    ["Native cadence", observation.native_temporal_resolution],
    ["Native resolution", observation.native_spatial_resolution_m ? `${observation.native_spatial_resolution_m.toLocaleString("en-IN")} m` : "—"],
    ["Boundary", observation.boundary_version],
    ["Quality", observation.quality_status.replaceAll("_", " ")],
  ];
  return (
    <section className="provenance panel" aria-labelledby="provenance-title">
      <div className="panel-heading">
        <div>
          <h2 id="provenance-title">Data provenance</h2>
          <p>Evidence attached to every stored value</p>
        </div>
        <span className="status-pill historical">Historical</span>
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="freshness-block">
        <span>Last successful ingestion</span>
        <strong>{dateTimeLabel.format(new Date(observation.ingested_at))}</strong>
      </div>
    </section>
  );
}

function RainfallContent({ response }: { response: DistrictObservationResponse }) {
  const rows = response.items;
  const chartData = useMemo(
    () => rows
      .filter((item): item is DistrictObservation & { mean_value: number } => item.mean_value !== null)
      .map((item) => ({
        date: formatDate(item.observation_time),
        timestamp: new Date(item.observation_time).getTime(),
        rainfall: item.mean_value,
      })),
    [rows],
  );
  const total = chartData.reduce((sum, item) => sum + item.rainfall, 0);
  const averageCoverage = rows.length
    ? rows.reduce((sum, item) => sum + (item.coverage_percentage ?? 0), 0) / rows.length
    : 0;
  const latest = rows.at(-1);

  if (!latest) {
    return <div className="empty-state">No stored observations exist for this validation window.</div>;
  }

  return (
    <>
      <section className="metric-strip" aria-label="Rainfall summary">
        <div><span>Acquisitions</span><strong>{rows.length}</strong><small>Daily source images</small></div>
        <div><span>Period accumulation</span><strong>{total.toFixed(2)} <em>mm</em></strong><small>Sum of district daily means</small></div>
        <div><span>Mean pixel coverage</span><strong>{averageCoverage.toFixed(1)}<em>%</em></strong><small>Valid area for stored rows</small></div>
        <div><span>Demo values</span><strong>{rows.filter((item) => item.is_demo).length}</strong><small>Must remain zero here</small></div>
      </section>

      <div className="primary-grid">
        <section className="chart-panel panel" aria-labelledby="rainfall-chart-title">
          <div className="panel-heading chart-heading">
            <div>
              <h2 id="rainfall-chart-title">District mean rainfall</h2>
              <p>True acquisition dates · straight segments · mm/day</p>
            </div>
            <div className="legend"><span aria-hidden="true" />CHIRPS daily rainfall</div>
          </div>
          <div className="chart-frame" aria-label="Beed district daily rainfall line chart">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 760, height: 270 }}
            >
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 3" />
                <XAxis dataKey="date" axisLine={{ stroke: "var(--control)" }} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={40} domain={[0, "auto"]} tickFormatter={(value) => `${value}`} />
                <Tooltip content={<ObservationTooltip />} cursor={{ stroke: "var(--control)", strokeWidth: 1 }} />
                <Line type="linear" dataKey="rainfall" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span className="active-range">3 days</span>
            <span>Validation slice: 01–03 Jun 2024</span>
          </div>
        </section>
        <ProvenancePanel observation={latest} />
      </div>

      <section className="observations panel" aria-labelledby="observation-title">
        <div className="panel-heading">
          <div>
            <h2 id="observation-title">Stored acquisitions</h2>
            <p>{rows.length} database rows returned by FastAPI</p>
          </div>
          <span className="quiet-stamp">Boundary aggregation · not farm-level</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Acquisition</th><th className="num">Mean</th><th className="num">Median</th><th className="num">Range</th><th className="num">Valid pixels</th><th className="num">Coverage</th><th>Quality</th></tr></thead>
            <tbody>
              {rows.map((item) => (
                <tr key={`${item.observation_time}-${item.variable_key}`}>
                  <td><strong>{new Date(item.observation_time).toISOString().slice(0, 10)}</strong><span>{item.source_key}</span></td>
                  <td className="num">{formatValue(item.mean_value)} <small>{item.unit}</small></td>
                  <td className="num">{formatValue(item.median_value)} <small>{item.unit}</small></td>
                  <td className="num">{formatValue(item.minimum_value)}–{formatValue(item.maximum_value)}</td>
                  <td className="num">{item.valid_pixel_count?.toLocaleString("en-IN") ?? "—"}<span> / {item.total_pixel_count?.toLocaleString("en-IN") ?? "—"}</span></td>
                  <td className="num">{formatValue(item.coverage_percentage, 1)}%</td>
                  <td><span className="status-pill quality">Source QA applied</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function DistrictRainfallScreen({
  initialData,
  initialError = null,
}: {
  initialData: DistrictObservationResponse | null;
  initialError?: string | null;
}) {
  const [data, setData] = useState<DistrictObservationResponse | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(initialData === null && initialError === null);

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getBeedRainfall(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unknown API error");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (initialData !== null || initialError !== null) return;
    const controller = new AbortController();
    getBeedRainfall(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unknown API error");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [initialData, initialError]);

  return (
    <div className="app-shell">
      <Rail />
      <main id="main">
        <header className="page-header">
          <div>
            <h1>Beed rainfall observations</h1>
            <p className="date-line">Historical integration check · 01–03 June 2024</p>
          </div>
          <div className="header-status">
            <span className="source-dot" aria-hidden="true" />
            <div><strong>Earth Engine → PostGIS → API</strong><span>Stored observations only</span></div>
          </div>
        </header>
        <div className="tabs" role="tablist" aria-label="District monitoring views">
          <button className="active" type="button" role="tab" aria-selected="true">Rainfall</button>
          <button type="button" role="tab" aria-selected="false" disabled>Vegetation</button>
          <button type="button" role="tab" aria-selected="false" disabled>Soil moisture</button>
        </div>
        {loading && <LoadingState />}
        {!loading && error && <ErrorState message={error} retry={load} />}
        {!loading && !error && data && <RainfallContent response={data} />}
      </main>
    </div>
  );
}

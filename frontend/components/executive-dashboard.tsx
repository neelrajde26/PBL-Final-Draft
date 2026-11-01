"use client";

import { Activity, Database, Info, Map, Satellite } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import {
  getDistrictRainfall,
  type District,
  type DistrictBoundaryCollection,
  type DistrictObservationResponse,
} from "@/lib/api";

const MaharashtraMap = dynamic(
  () => import("@/components/maharashtra-map").then((module) => module.MaharashtraMap),
  { ssr: false, loading: () => <div className="map-loading">Preparing district geometry…</div> },
);

const navItems = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/districts", label: "Districts", icon: Map },
  { href: "/satellite", label: "Satellite", icon: Satellite },
  { href: "/methodology", label: "Methods", icon: Info },
];

type Props = {
  districts: District[];
  boundaries: DistrictBoundaryCollection;
  initialObservations: DistrictObservationResponse;
};

function ShellRail() {
  return (
    <aside className="rail" aria-label="Primary navigation">
      <Link className="brand-mark" href="/" aria-label="MDIS overview"><span>MH</span></Link>
      <nav className="rail-nav">
        {navItems.map(({ href, label, icon: Icon }, index) => (
          <Link className={`rail-action${index === 0 ? " active" : ""}`} href={href} key={href} title={label}>
            <Icon aria-hidden="true" size={17} strokeWidth={1.6} />
            <span className="rail-label">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="rail-utils"><Database aria-hidden="true" size={17} /><span>Stored data</span></div>
    </aside>
  );
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function ExecutiveDashboard({ districts, boundaries, initialObservations }: Props) {
  const [selectedId, setSelectedId] = useState("beed");
  const [observations, setObservations] = useState(initialObservations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = districts.find((district) => district.id === selectedId) ?? districts[0];
  const observedDistrictIds = useMemo(
    () => (initialObservations.count > 0 ? [initialObservations.district_id] : []),
    [initialObservations],
  );

  const chooseDistrict = useCallback((districtId: string) => {
    setSelectedId(districtId);
    setLoading(true);
    setError(null);
    getDistrictRainfall(districtId)
      .then(setObservations)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unknown API error"))
      .finally(() => setLoading(false));
  }, []);

  const chartData = observations.items
    .filter((item) => item.mean_value !== null)
    .map((item) => ({ date: formatDay(item.observation_time), rainfall: item.mean_value }));
  const accumulated = chartData.reduce((total, item) => total + (item.rainfall ?? 0), 0);
  const coverage = observations.items.length
    ? observations.items.reduce((total, item) => total + (item.coverage_percentage ?? 0), 0) / observations.items.length
    : null;
  const latest = observations.items.at(-1);

  return (
    <div className="app-shell">
      <ShellRail />
      <main id="main" className="dashboard-main">
        <header className="page-header">
          <div>
            <h1>Maharashtra drought intelligence</h1>
            <p>District geometry and stored satellite evidence. No synthetic statewide drought values.</p>
          </div>
          <div className="header-status"><span className="source-dot" /><div><strong>System evidence</strong><span>PostGIS and stored GEE observations</span></div></div>
        </header>

        <section className="metric-strip" aria-label="Verified platform coverage">
          <div><span>District registry</span><strong className="num">{districts.length}</strong><small>All Maharashtra districts</small></div>
          <div><span>Active boundaries</span><strong className="num">{boundaries.count}</strong><small>Versioned MultiPolygons</small></div>
          <div><span>Stored observation districts</span><strong className="num">{observedDistrictIds.length}</strong><small>Current validation interval</small></div>
          <div><span>Demo observations</span><strong className="num">{initialObservations.items.filter((item) => item.is_demo).length}</strong><small>Must remain zero</small></div>
        </section>

        <section className="map-section" id="map" aria-labelledby="map-title">
          <div className="section-heading">
            <div><h2 id="map-title">Statewide spatial coverage</h2><p>Click a district to inspect the stored CHIRPS validation interval.</p></div>
            <div className="map-key"><span><i className="key-stored" />Stored observations</span><span><i className="key-selected" />Selected district</span><span><i className="key-boundary" />Boundary only</span></div>
          </div>
          <div className="map-workspace">
            <MaharashtraMap boundaries={boundaries} selectedDistrictId={selectedId} observedDistrictIds={observedDistrictIds} onSelect={chooseDistrict} />
            <aside className="district-inspector" aria-live="polite">
              <div><span>Selected district</span><h3>{selected.name}</h3><p>{selected.region}</p></div>
              <dl>
                <div><dt>Boundary</dt><dd>{selected.boundary_available ? selected.boundary_version : "Unavailable"}</dd></div>
                <div><dt>Stored rows</dt><dd className="num">{loading ? "…" : observations.count}</dd></div>
                <div><dt>Period total</dt><dd className="num">{loading ? "…" : observations.count ? `${accumulated.toFixed(2)} mm` : "—"}</dd></div>
                <div><dt>Mean coverage</dt><dd className="num">{loading ? "…" : coverage === null ? "—" : `${coverage.toFixed(1)}%`}</dd></div>
              </dl>
              {!loading && observations.count === 0 && <p className="availability-note">No stored rainfall observations exist for this district in 01–03 June 2024.</p>}
              {error && <p className="error-copy">{error}. No demonstration data was substituted.</p>}
            </aside>
          </div>
        </section>

        <div className="evidence-grid" id="observations">
          <section className="panel chart-panel" aria-labelledby="rainfall-title">
            <div className="panel-heading"><div><h2 id="rainfall-title">{selected.name} rainfall</h2><p>District daily mean · 01–03 June 2024</p></div><span className="status-text">Historical</span></div>
            {chartData.length ? (
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 220 }}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "var(--control)" }} tick={{ fill: "var(--secondary)", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} width={38} tick={{ fill: "var(--secondary)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#193B4A", border: "1px solid #28505C", borderRadius: 4 }} formatter={(value) => [`${Number(value).toFixed(2)} mm/day`, "Rainfall"]} />
                    <Line type="linear" dataKey="rainfall" stroke="var(--aqua)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="chart-empty">The zero-data frame is preserved. No series is available for this district and period.</div>}
          </section>

          <section className="panel provenance" id="sources" aria-labelledby="source-title">
            <div className="panel-heading"><div><h2 id="source-title">Evidence record</h2><p>Source and processing context</p></div></div>
            <dl>
              <div><dt>Source</dt><dd>{latest?.source_name ?? "—"}</dd></div>
              <div><dt>Product</dt><dd>{latest?.product_id ?? "—"}</dd></div>
              <div><dt>Native cadence</dt><dd>{latest?.native_temporal_resolution ?? "—"}</dd></div>
              <div><dt>Native resolution</dt><dd>{latest?.native_spatial_resolution_m ? `${latest.native_spatial_resolution_m.toLocaleString("en-IN")} m` : "—"}</dd></div>
              <div><dt>Quality</dt><dd>{latest?.quality_status.replaceAll("_", " ") ?? "Unavailable"}</dd></div>
              <div><dt>Acquired</dt><dd>{latest ? new Date(latest.observation_time).toISOString().slice(0, 10) : "—"}</dd></div>
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}

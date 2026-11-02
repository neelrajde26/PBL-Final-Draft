"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import {
  getBeedRainfall,
  getDistrictBoundaries,
  getDistrictRainfall,
  getDistricts,
  getReadiness,
  type District,
  type DistrictBoundaryCollection,
  type DistrictObservationResponse,
  type Readiness,
} from "@/lib/api";

const MaharashtraMap = dynamic(
  () => import("@/components/maharashtra-map").then((module) => module.MaharashtraMap),
  { ssr: false, loading: () => <div className="map-loading">Preparing district geometry…</div> },
);

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown service error";
}

function DomainError({ title, detail, retry }: { title: string; detail: string; retry: () => void }) {
  return (
    <div className="domain-error" role="alert">
      <div><strong>{title}</strong><p>{detail}. No demonstration data was substituted.</p></div>
      <button type="button" onClick={retry}>Retry</button>
    </div>
  );
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function ExecutiveDashboard() {
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [boundaries, setBoundaries] = useState<DistrictBoundaryCollection | null>(null);
  const [observations, setObservations] = useState<DistrictObservationResponse | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [selectedId, setSelectedId] = useState("beed");
  const [observedIds, setObservedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({
    districts: true, boundaries: true, observations: true, readiness: true,
  });
  const observationRequest = useRef<AbortController | null>(null);

  const setDomain = useCallback((domain: string, isLoading: boolean, error?: string) => {
    setLoading((current) => ({ ...current, [domain]: isLoading }));
    setErrors((current) => {
      const next = { ...current };
      if (error) next[domain] = error;
      else delete next[domain];
      return next;
    });
  }, []);

  const loadDistricts = useCallback(async (signal?: AbortSignal) => {
    setDomain("districts", true);
    try {
      const response = await getDistricts(signal);
      setDistricts(response.items);
      setDomain("districts", false);
    } catch (reason) {
      if (signal?.aborted) return;
      setDomain("districts", false, message(reason));
    }
  }, [setDomain]);

  const loadBoundaries = useCallback(async (signal?: AbortSignal) => {
    setDomain("boundaries", true);
    try {
      setBoundaries(await getDistrictBoundaries(signal));
      setDomain("boundaries", false);
    } catch (reason) {
      if (signal?.aborted) return;
      setDomain("boundaries", false, message(reason));
    }
  }, [setDomain]);

  const loadReadiness = useCallback(async (signal?: AbortSignal) => {
    setDomain("readiness", true);
    try {
      setReadiness(await getReadiness(signal));
      setDomain("readiness", false);
    } catch (reason) {
      if (signal?.aborted) return;
      setDomain("readiness", false, message(reason));
    }
  }, [setDomain]);

  const loadObservations = useCallback(async (districtId: string) => {
    observationRequest.current?.abort();
    const controller = new AbortController();
    observationRequest.current = controller;
    setDomain("observations", true);
    try {
      const response = districtId === "beed"
        ? await getBeedRainfall(controller.signal)
        : await getDistrictRainfall(districtId, controller.signal);
      setObservations(response);
      if (response.count > 0) {
        setObservedIds((current) => new Set(current).add(response.district_id));
      }
      setDomain("observations", false);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setDomain("observations", false, message(reason));
    }
  }, [setDomain]);

  useEffect(() => {
    const controller = new AbortController();
    const start = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      void loadDistricts(controller.signal);
      void loadBoundaries(controller.signal);
      void loadReadiness(controller.signal);
      void loadObservations("beed");
    };
    void start();
    return () => {
      controller.abort();
      observationRequest.current?.abort();
    };
  }, [loadBoundaries, loadDistricts, loadObservations, loadReadiness]);

  const chooseDistrict = useCallback((districtId: string) => {
    setSelectedId(districtId);
    void loadObservations(districtId);
  }, [loadObservations]);

  const selected = districts?.find((district) => district.id === selectedId) ?? null;
  const observedDistrictIds = useMemo(() => [...observedIds], [observedIds]);
  const chartData = (observations?.items ?? [])
    .filter((item) => item.mean_value !== null)
    .map((item) => ({ date: formatDay(item.observation_time), rainfall: item.mean_value }));
  const accumulated = chartData.reduce((total, item) => total + (item.rainfall ?? 0), 0);
  const coverage = observations?.items.length
    ? observations.items.reduce((total, item) => total + (item.coverage_percentage ?? 0), 0) / observations.items.length
    : null;
  const latest = observations?.items.at(-1);
  const demoCount = observations?.items.filter((item) => item.is_demo).length ?? null;

  return (
    <main id="main" className="dashboard-main">
        <header className="page-header">
          <div><h1>Maharashtra drought intelligence</h1><p>District geometry and stored satellite evidence. No synthetic statewide drought values.</p></div>
          <div className="service-health" aria-live="polite">
            <span className={readiness?.database.available ? "service-up" : "service-down"}>Database {loading.readiness ? "checking" : readiness?.database.available ? "connected" : "unavailable"}</span>
            <span className={readiness?.gee.available ? "service-up" : "service-down"}>GEE {loading.readiness ? "checking" : readiness?.gee.available ? "initialized" : "unavailable"}</span>
            {errors.readiness && <button type="button" onClick={() => void loadReadiness()}>Retry status</button>}
          </div>
        </header>

        <section className="metric-strip" aria-label="Verified platform coverage">
          <div><span>District registry</span><strong className="num">{districts?.length ?? "—"}</strong><small>{errors.districts ? "Service unavailable" : "All Maharashtra districts"}</small></div>
          <div><span>Active boundaries</span><strong className="num">{boundaries?.count ?? "—"}</strong><small>{errors.boundaries ? "Geometry unavailable" : "Versioned MultiPolygons"}</small></div>
          <div><span>Stored observation districts</span><strong className="num">{observedIds.size || (loading.observations ? "…" : "—")}</strong><small>Queried validation interval</small></div>
          <div><span>Demo observations</span><strong className="num">{demoCount ?? "—"}</strong><small>{demoCount === null ? "Not loaded" : "Must remain zero"}</small></div>
        </section>

        {errors.districts && <DomainError title="District registry unavailable" detail={errors.districts} retry={() => void loadDistricts()} />}
        {errors.boundaries && <DomainError title="District geometry unavailable" detail={errors.boundaries} retry={() => void loadBoundaries()} />}

        <section className="map-section" aria-labelledby="map-title">
          <div className="section-heading">
            <div><h2 id="map-title">Statewide spatial coverage</h2><p>Click a district to inspect the stored CHIRPS validation interval.</p></div>
            <div className="map-key"><span><i className="key-stored" />Stored observations</span><span><i className="key-selected" />Selected district</span><span><i className="key-boundary" />Boundary only</span></div>
          </div>
          <div className="map-workspace">
            {boundaries && districts ? (
              <MaharashtraMap boundaries={boundaries} selectedDistrictId={selectedId} observedDistrictIds={observedDistrictIds} onSelect={chooseDistrict} />
            ) : (
              <div className="map-loading">{loading.boundaries || loading.districts ? "Loading district geometry…" : "District geometry is unavailable."}</div>
            )}
            <aside className="district-inspector" aria-live="polite">
              <div><span>Selected district</span><h3>{selected?.name ?? "Beed"}</h3><p>{selected?.region ?? "Registry loading"}</p></div>
              <dl>
                <div><dt>Boundary</dt><dd>{selected?.boundary_available ? selected.boundary_version : selected ? "Unavailable" : "—"}</dd></div>
                <div><dt>Stored rows</dt><dd className="num">{loading.observations ? "…" : observations?.count ?? "—"}</dd></div>
                <div><dt>Period total</dt><dd className="num">{loading.observations ? "…" : observations?.count ? `${accumulated.toFixed(2)} mm` : "—"}</dd></div>
                <div><dt>Mean coverage</dt><dd className="num">{loading.observations ? "…" : coverage === null ? "—" : `${coverage.toFixed(1)}%`}</dd></div>
              </dl>
              {!loading.observations && observations?.count === 0 && <p className="availability-note">No stored rainfall observations exist for this district in 01–03 June 2024.</p>}
              {errors.observations && <DomainError title="Observations unavailable" detail={errors.observations} retry={() => void loadObservations(selectedId)} />}
            </aside>
          </div>
        </section>

        <div className="evidence-grid">
          <section className="panel chart-panel" aria-labelledby="rainfall-title">
            <div className="panel-heading"><div><h2 id="rainfall-title">{selected?.name ?? "District"} rainfall</h2><p>District daily mean · 01–03 June 2024</p></div><span className="status-text">Historical</span></div>
            {chartData.length ? (
              <div className="chart-frame"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 220 }}><LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}><CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "var(--control)" }} tick={{ fill: "var(--secondary)", fontSize: 12 }} /><YAxis tickLine={false} axisLine={false} width={38} tick={{ fill: "var(--secondary)", fontSize: 12 }} /><Tooltip contentStyle={{ background: "#193B4A", border: "1px solid #28505C", borderRadius: 4 }} formatter={(value) => [`${Number(value).toFixed(2)} mm/day`, "Rainfall"]} /><Line type="linear" dataKey="rainfall" stroke="var(--aqua)" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            ) : <div className="chart-empty">{loading.observations ? "Loading stored observations…" : "No series is available for this district and period."}</div>}
          </section>

          <section className="panel provenance" aria-labelledby="source-title">
            <div className="panel-heading"><div><h2 id="source-title">Evidence record</h2><p>Source and processing context</p></div></div>
            <dl><div><dt>Source</dt><dd>{latest?.source_name ?? "—"}</dd></div><div><dt>Product</dt><dd>{latest?.product_id ?? "—"}</dd></div><div><dt>Native cadence</dt><dd>{latest?.native_temporal_resolution ?? "—"}</dd></div><div><dt>Native resolution</dt><dd>{latest?.native_spatial_resolution_m ? `${latest.native_spatial_resolution_m.toLocaleString("en-IN")} m` : "—"}</dd></div><div><dt>Quality</dt><dd>{latest?.quality_status.replaceAll("_", " ") ?? "Unavailable"}</dd></div><div><dt>Acquired</dt><dd>{latest ? new Date(latest.observation_time).toISOString().slice(0, 10) : "—"}</dd></div></dl>
          </section>
        </div>
      </main>
  );
}

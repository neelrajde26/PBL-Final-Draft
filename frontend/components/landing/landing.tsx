"use client";

import Lenis from "lenis";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CountUp, FilmGrain, PipelineScene, ScrollWords, Timecode, TitleSequence, YearScene } from "@/components/landing/cinema";
import { stateShape, StateMark } from "@/components/landing/state-mark";
import {
  getDistrictIndicators,
  getDistricts,
  getReadiness,
  type District,
  type IndicatorCollection,
  type Readiness,
} from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import "./landing.css";
import "./cinema.css";

const EASE = [0.22, 1, 0.36, 1] as const;

type Indicator = {
  id: string;
  name: string;
  fact: string;
  unit: string;
  ramp: [string, string];
  invert?: boolean;
};

const INDICATORS: Indicator[] = [
  { id: "rainfall", name: "Rainfall", unit: "mm", fact: "CHIRPS daily precipitation, 5.5 km grid, summed per district.", ramp: ["#1b3550", "#3fe0ff"] },
  { id: "ndvi", name: "Green cover", unit: "NDVI", fact: "MODIS MOD13Q1 vegetation index, 250 m, 16-day composites.", ramp: ["#8a4b1c", "#7cf06b"] },
  { id: "lst", name: "Land heat", unit: "°C", fact: "MODIS MOD11A2 daytime land-surface temperature, 1 km, 8-day.", ramp: ["#ffd166", "#ff2e63"] },
  { id: "soil_moisture", name: "Soil moisture", unit: "m³/m³", fact: "ERA5-Land volumetric soil water, top layer, daily aggregate.", ramp: ["#5a3b2a", "#54d6bd"] },
  { id: "vhi", name: "Vegetation health", unit: "VHI", fact: "VCI and TCI combined; below 35 marks agricultural drought stress.", ramp: ["#ff4f7b", "#7cf06b"] },
];

const POINTS = [
  { col: 0, title: "Farmer portal", text: "District status in Marathi and English, read aloud, with field reports from the village." },
  { col: 1, title: "Live GIS map", text: "All 36 districts on a real basemap, switchable between observed and predicted layers." },
  { col: 2, title: "Backtesting", text: "Forecasts replayed against what really happened, district by district, season by season." },
  { col: 0, title: "Early warning", text: "Alerts raised only from measured thresholds, each with the data behind it." },
  { col: 1, title: "Researcher hub", text: "Every series exportable with its source, unit, resolution and processing version." },
  { col: 2, title: "Admin console", text: "Ingestion jobs, Earth Engine connectivity and model registry, from real health checks." },
];

function useLenis(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    (window as unknown as { lenis?: Lenis }).lenis = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function Landing() {
  const reduce = useReducedMotion() ?? false;
  useLenis(!reduce);
  const [intro, setIntro] = useState(true);

  const [districts, setDistricts] = useState<District[] | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [active, setActive] = useState(INDICATORS[0]);
  const layerLoad = useLoad<IndicatorCollection>(`layer:${active.id}`, (s) => getDistrictIndicators(active.id, undefined, undefined, s));
  const layer = layerLoad.data;
  const layerState: "loading" | "ok" | "error" = layer ? "ok" : layerLoad.error ? "error" : "loading";

  useEffect(() => {
    const ctrl = new AbortController();
    const fail = (e: unknown) => {
      if ((e as Error)?.name !== "AbortError" && !ctrl.signal.aborted) setApiDown(true);
    };
    getDistricts(ctrl.signal).then((r) => setDistricts(r.items)).catch(fail);
    getReadiness(ctrl.signal).then(setReadiness).catch(fail);
    return () => ctrl.abort();
  }, []);


  const values = useMemo(() => {
    const m = new Map<string, number>();
    layer?.features.forEach((f) => {
      if (f.properties.measured_value != null) m.set(f.properties.district_id, f.properties.measured_value);
    });
    return m;
  }, [layer]);
  const [lo, hi] = useMemo(() => {
    const v = [...values.values()];
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
  }, [values]);
  const latest = useMemo(
    () =>
      layer?.features
        .map((f) => f.properties.observation_date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    [layer],
  );

  const bounded = districts?.filter((d) => d.boundary_available).length;
  const geeLive = readiness?.gee?.available === true;

  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const shapeY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "8%"]);
  const shapeRot = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -6]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-30%"]);

  return (
    <div className="lp">
      {intro && <TitleSequence onDone={() => setIntro(false)} />}
      <FilmGrain />
      <Timecode />
      <header className="lp-top">
        <Link href="/" className="lp-word" aria-label="DroughtLens home">
          <StateMark className="lp-word-mark" />
          DroughtLens
        </Link>
        <nav className="lp-topnav" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#layers">Live layers</a>
          <a href="#tools">Tools</a>
        </nav>
        <Link href="/overview" className="lp-top-cta">
          Open dashboard
        </Link>
      </header>

      {/* Hero: the state itself, enormous, cropped by the viewport */}
      <section ref={hero} className="lp-hero">
        <div className="cn-aurora" aria-hidden>
          <span /><span /><span />
        </div>
        <motion.div className="lp-hero-shape" style={{ y: shapeY, rotate: shapeRot }} aria-hidden>
          <div className="lp-hero-photo">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/media/godavari-puntamba.jpg"
              preload="none"
            >
              <source src="/media/sat/ndvi-cycle.mp4" type="video/mp4" />
            </video>
          </div>
          <svg viewBox={stateShape.viewBox} className="lp-hero-lines">
            {stateShape.districts.map((d) => (
              <path key={d.id} d={d.d} />
            ))}
          </svg>
        </motion.div>

        <motion.div className="lp-hero-copy" style={{ y: textY }}>
          <motion.p
            className="lp-kicker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: reduce ? 0 : 2.2 }}
          >
            Maharashtra · 36 districts · satellite record since 2000
          </motion.p>
          <h1 className="lp-h1">
            {["Drought,", "seen early."].map((line, i) => (
              <span key={line} className="lp-line">
                <motion.span
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 1.1, ease: EASE, delay: (reduce ? 0 : 2.3) + i * 0.14 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="lp-lead"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 2.7 }}
          >
            DroughtLens turns satellite rainfall, vegetation and soil-moisture records into district drought
            warnings for farmers, officers and researchers across Maharashtra.
          </motion.p>
          <motion.div
            className="lp-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 2.85 }}
          >
            <Link href="/map" className="lp-btn">
              Open the live map
            </Link>
            <a href="#how" className="lp-link">
              How it works
            </a>
          </motion.div>
        </motion.div>

        <div className="lp-status" role="status">
          <span className={`lp-dot ${geeLive ? "is-live" : apiDown ? "is-down" : "is-warn"}`} />
          {apiDown
            ? "Backend unreachable: figures below are unavailable"
            : !readiness
              ? "Checking data services…"
              : geeLive
                ? `Earth Engine connected · project ${readiness.gee.project_id}`
                : "Earth Engine not connected · showing stored records only"}
        </div>
      </section>

      <YearScene />

      <section className="lp-statement">
        <ScrollWords
          className="cn-words"
          text="Satellites measure the rain, the green of the fields and the heat of the soil over every district. We read those records before the wells run dry."
        />
      </section>

      <PipelineScene />

      {/* Showcase: the live thing */}
      <section id="layers" className="lp-show">
        <div className="lp-show-list">
          <h2 className="lp-h3 lp-muted">Live layers</h2>
          <ul role="tablist" aria-label="Indicator">
            {INDICATORS.map((ind) => (
              <li key={ind.id}>
                <button
                  role="tab"
                  aria-selected={ind.id === active.id}
                  className={ind.id === active.id ? "is-on" : ""}
                  onClick={() => setActive(ind)}
                  onMouseEnter={() => setActive(ind)}
                >
                  <StateMark className="lp-bullet" />
                  {ind.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-show-map">
          <svg viewBox={stateShape.viewBox} role="img" aria-label={`${active.name} by district`}>
            {stateShape.districts.map((d) => {
              const v = values.get(d.id);
              const t = v == null ? null : hi === lo ? 0.5 : (v - lo) / (hi - lo);
              return (
                <motion.path
                  key={d.id}
                  d={d.d}
                  initial={false}
                  animate={{ fill: t == null ? "#122f3f" : mix(active.ramp[0], active.ramp[1], t) }}
                  transition={{ duration: 0.5 }}
                >
                  <title>{`${d.name}: ${v == null ? "no observation stored" : `${v.toFixed(2)} ${active.unit}`}`}</title>
                </motion.path>
              );
            })}
          </svg>
        </div>

        <div className="lp-show-fact" aria-live="polite">
          <p className="lp-fact-title">{active.name}</p>
          <p>{active.fact}</p>
          <p className="lp-fact-data">
            {layerState === "loading"
              ? "Loading district values…"
              : layerState === "error"
                ? "Could not reach the data service."
                : values.size === 0
                  ? "No observations stored yet for this layer. Run an Earth Engine ingestion to fill it."
                  : `${values.size} of 36 districts observed · latest ${formatDate(latest)}`}
          </p>
          {values.size > 0 && (
            <div className="lp-ramp" style={{ background: `linear-gradient(90deg, ${active.ramp[0]}, ${active.ramp[1]})` }}>
              <span>
                {lo.toFixed(1)} {active.unit}
              </span>
              <span>{hi.toFixed(1)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Figures, all from the API */}
      <section className="lp-stats">
        <Reveal className="lp-stat lp-stat-a">
          <strong><CountUp value={bounded} /></strong>
          <span>districts with verified boundaries, Survey of India 2025</span>
        </Reveal>
        <div className="lp-stats-right">
          <h2 className="lp-h3">What is real today</h2>
          <Reveal delay={0.1} className="lp-stat lp-stat-b">
            <strong><CountUp value={layerState === "ok" ? values.size : null} /></strong>
            <span>districts with a stored {active.name.toLowerCase()} observation</span>
          </Reveal>
          <Reveal delay={0.2} className="lp-stat lp-stat-c">
            <strong className="lp-stat-small">{formatDate(latest) ?? "None yet"}</strong>
            <span>latest stored observation</span>
          </Reveal>
        </div>
      </section>

      {/* Tools */}
      <section id="tools" className="lp-tools">
        <motion.div
          className="lp-tools-photo"
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <img src="/media/godavari-puntamba.jpg" alt="The Godavari riverbed at Puntamba in January, mostly dry rock" loading="lazy" />
        </motion.div>
        <div className="lp-tools-body">
          <Reveal>
            <h2 className="lp-h2">One record, four doors</h2>
          </Reveal>
          <div className="lp-points">
            {POINTS.map((p, i) => (
              <Reveal key={p.title} delay={(i % 3) * 0.08} className="lp-point">
                <h3>
                  <StateMark className={`lp-bullet c${p.col}`} />
                  {p.title}
                </h3>
                <p>{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Link href="/overview" className="lp-cta">
        <span className="lp-cta-note">Open the dashboard: the map, the indices and the forecast for every district.</span>
        <svg className="lp-cta-arrow" viewBox="0 0 48 48" aria-hidden>
          <path d="M12 36 36 12M16 12h20v20" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
        <span className="lp-cta-word">Explore</span>
      </Link>

      <footer className="lp-foot">
        <div className="lp-foot-mark" aria-hidden>
          {"DROUGHTLENS".split("").map((c, i) => (
            <span key={i} style={{ height: `${62 + ((i * 37) % 38)}%` }}>
              {c}
            </span>
          ))}
        </div>
        <div className="lp-foot-cols">
          <div>
            <h4>Monitor</h4>
            <Link href="/overview">Overview</Link>
            <Link href="/map">GIS map</Link>
            <Link href="/indices">Drought indices</Link>
            <Link href="/alerts">Early warning</Link>
          </div>
          <div>
            <h4>Forecast</h4>
            <Link href="/predictions">Predictions</Link>
            <Link href="/backtesting">Backtesting</Link>
            <Link href="/models">Model insights</Link>
            <Link href="/historical">Historical analytics</Link>
          </div>
          <div>
            <h4>Portals</h4>
            <Link href="/farmer">Farmer portal</Link>
            <Link href="/researcher">Researcher hub</Link>
            <Link href="/admin">Admin console</Link>
          </div>
          <div>
            <h4>About</h4>
            <Link href="/methodology">Methodology</Link>
            <Link href="/data-sources">Data sources</Link>
            <Link href="/about">Project</Link>
          </div>
        </div>
        <p className="lp-credits">
          Pictures:{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=18724878">“The Godavari river at Puntamba in January”</a> by
          Shakher59, <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>;{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=59641509">“Western ghats monsoon time”</a> by Mariappan
          Ramachandran, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>;{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=80660305">“Turmeric farm”</a> by Albert Deccan,{" "}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>;{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=81531846">“Plowing the land in India”</a> by Phil Bus,{" "}
          <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>;{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=90076337">“Cracked earth after prolonged drought”</a> by
          Rosser1954, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>; all via Wikimedia Commons.
          Satellite data: CHIRPS (UCSB-CHG), MODIS (NASA LP DAAC), ERA5-Land (ECMWF/Copernicus), via Google Earth Engine.
        </p>
        <div className="lp-foot-last">
          <span>DroughtLens · Maharashtra Drought Intelligence System · PBL project</span>
          <a href="#top" className="lp-btn lp-btn-sm" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}

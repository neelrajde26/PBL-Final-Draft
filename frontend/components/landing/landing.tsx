"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CountUp, FilmGrain, Rain, TitleSequence } from "@/components/landing/cinema";
import { stateShape, StateMark } from "@/components/landing/state-mark";
import { getDistrictIndicators, getDistricts, getReadiness, type IndicatorCollection } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import "./cinema.css";
import "./story.css";

const EASE = [0.22, 1, 0.36, 1] as const;
const LOCK_MS = 1150;

/* ---------- content ---------- */

const MONTHS = [
  { m: "June", title: "The monsoon arrives", text: "Most of the year's rain falls in just four months. When it comes late, every crop downstream is late too.", img: "/media/ghats-monsoon.jpg", rain: 1, heat: 0, tint: "#2fd6c0" },
  { m: "August", title: "Fields turn green", text: "Kharif crops come up. From space this shows as a rising vegetation index, district by district.", img: "/media/turmeric-farm.jpg", rain: 0.35, heat: 0, tint: "#7cf06b" },
  { m: "November", title: "Harvest, then the plough", text: "The soil still holds the monsoon's water. How much it holds decides the winter crop.", img: "/media/ploughing.jpg", rain: 0, heat: 0, tint: "#ffb547" },
  { m: "March", title: "The rivers thin out", text: "By spring the Godavari runs over bare rock at Puntamba. Reservoirs fall week by week.", img: "/media/godavari-puntamba.jpg", rain: 0, heat: 0.5, tint: "#ff7a59" },
  { m: "May", title: "The ground cracks", text: "Heat peaks just before the rain returns. This is the gap DroughtLens is built to watch.", img: "/media/cracked-earth.jpg", rain: 0, heat: 1, tint: "#ff4f7b" },
];

const STEPS = [
  { n: "1", name: "Observe", text: "Satellites measure rain, crop greenness, land heat and soil water for all 36 districts.", color: "#54d6bd" },
  { n: "2", name: "Measure", text: "We turn those readings into the standard drought scores officers already use.", color: "#7cf06b" },
  { n: "3", name: "Forecast", text: "A model trained on past years estimates next month's drought risk.", color: "#ffb547" },
  { n: "4", name: "Warn", text: "Districts that cross a drought line get an alert in Marathi and English.", color: "#f4bbd0" },
];

const INDICATORS = [
  { id: "rainfall", name: "Rainfall", unit: "mm", fact: "How much rain fell last month (CHIRPS satellite rainfall).", ramp: ["#1b3550", "#3fe0ff"] as const },
  { id: "ndvi", name: "Crop greenness", unit: "NDVI", fact: "How green the land is (MODIS vegetation index). Low = dry or bare.", ramp: ["#8a4b1c", "#7cf06b"] as const },
  { id: "lst", name: "Land heat", unit: "°C", fact: "Daytime ground temperature (MODIS). High = heat stress.", ramp: ["#ffd166", "#ff2e63"] as const },
  { id: "soil_moisture", name: "Soil moisture", unit: "m³/m³", fact: "Water in the top soil layer (ERA5-Land).", ramp: ["#5a3b2a", "#54d6bd"] as const },
  { id: "vhi", name: "Crop health", unit: "VHI", fact: "Greenness and heat combined. Below 35 means crops are stressed.", ramp: ["#ff4f7b", "#7cf06b"] as const },
];

const TOOLS = [
  { href: "/overview", title: "Dashboard", text: "Every district at a glance", c: "#54d6bd" },
  { href: "/map", title: "Live map", text: "Satellite map, layer by layer", c: "#3fe0ff" },
  { href: "/backtesting", title: "Accuracy", text: "How past forecasts did", c: "#ffb547" },
  { href: "/farmer", title: "Farmer portal", text: "Marathi, read aloud", c: "#7cf06b" },
  { href: "/researcher", title: "Researcher hub", text: "Download the data", c: "#f4bbd0" },
  { href: "/alerts", title: "Early warning", text: "Districts in drought now", c: "#ff4f7b" },
];

const CHAPTERS = ["Start", ...MONTHS.map((m) => m.m), "How it works", "Live layers", "What's real", "Tools", "Explore"];

function mix(a: string, b: string, t: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : null);

/* ---------- motion helpers ---------- */

const item = {
  hidden: { opacity: 0, y: 40 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: 0.25 + i * 0.1 } }),
};
function Up({ i = 0, className, children }: { i?: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={item} custom={i} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/* ---------- chapters ---------- */

function Hero({ status }: { status: string }) {
  return (
    <div className="st-ch st-hero">
      <div className="cn-aurora" aria-hidden>
        <span /><span /><span />
      </div>
      <motion.div className="st-hero-shape" initial={{ opacity: 0, scale: 1.08, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1.6, ease: EASE }} aria-hidden>
        <div className="st-hero-photo" />
        <svg viewBox={stateShape.viewBox} className="st-hero-lines">
          {stateShape.districts.map((d) => <path key={d.id} d={d.d} />)}
        </svg>
      </motion.div>
      <div className="st-copy">
        <Up><p className="st-kicker">Maharashtra · 36 districts · satellite data</p></Up>
        <h1 className="st-h1">
          {["Drought,", "seen early."].map((line, i) => (
            <span key={line} className="st-line">
              <motion.span initial={{ y: "110%" }} animate={{ y: "0%" }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 + i * 0.14 }}>
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <Up i={3}><p className="st-lead">We watch rain, crops and soil from space, and warn districts before drought hits.</p></Up>
        <Up i={4} className="st-actions">
          <Link href="/overview" className="st-btn">Open the dashboard</Link>
        </Up>
      </div>
      <p className="st-status"><span className="st-dot" data-s={status} />{status === "live" ? "Live satellite connection" : status === "down" ? "Data service offline" : "Satellite data not connected yet"}</p>
    </div>
  );
}

function MonthChapter({ idx }: { idx: number }) {
  const mo = MONTHS[idx];
  const rain = useMotionValue(mo.rain);
  return (
    <div className="st-ch st-month">
      <motion.div className="st-bg" style={{ backgroundImage: `url(${mo.img})` }} initial={{ scale: 1.25 }} animate={{ scale: 1.05 }} transition={{ duration: 7, ease: "linear" }} role="img" aria-label={mo.title} />
      <div className="st-tint" style={{ background: mo.tint }} />
      <div className="st-shade" />
      {mo.rain > 0 && <Rain intensity={rain} className="cn-rain" />}
      {mo.heat > 0 && <div className="cn-heat" style={{ opacity: mo.heat }} />}
      <div className="st-copy st-month-copy">
        <Up><p className="st-kicker">One year in Maharashtra · {idx + 1} of 5</p></Up>
        <div className="st-line">
          <motion.h2 className="st-month-name" initial={{ y: "100%" }} animate={{ y: "0%" }} transition={{ duration: 1, ease: EASE, delay: 0.15 }}>
            {mo.m}
          </motion.h2>
        </div>
        <Up i={2}><h3 className="st-h3">{mo.title}</h3></Up>
        <Up i={3}><p className="st-lead">{mo.text}</p></Up>
      </div>
      <div className="st-months" aria-hidden>
        {MONTHS.map((m, i) => (
          <span key={m.m} className={i === idx ? "is-on" : i < idx ? "is-past" : ""}>{m.m}</span>
        ))}
      </div>
    </div>
  );
}

function HowChapter() {
  return (
    <div className="st-ch st-how">
      <div className="st-copy st-wide">
        <Up><p className="st-kicker">How it works</p></Up>
        <Up i={1}><h2 className="st-h2">From satellite to warning, in four steps</h2></Up>
        <div className="st-steps">
          {STEPS.map((s, i) => (
            <motion.div key={s.n} className="st-step" style={{ ["--c" as string]: s.color }} initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.45 + i * 0.15 }}>
              <span className="st-step-n">{s.n}</span>
              <h3>{s.name}</h3>
              <p>{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayersChapter() {
  const [active, setActive] = useState(INDICATORS[0]);
  const load = useLoad<IndicatorCollection>(`layer:${active.id}`, (s) => getDistrictIndicators(active.id, undefined, undefined, s));
  const values = useMemo(() => {
    const m = new Map<string, number>();
    load.data?.features.forEach((f) => f.properties.measured_value != null && m.set(f.properties.district_id, f.properties.measured_value));
    return m;
  }, [load.data]);
  const [lo, hi] = useMemo(() => {
    const v = [...values.values()];
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
  }, [values]);
  const latest = load.data?.features.map((f) => f.properties.observation_date).filter(Boolean).sort().at(-1);

  return (
    <div className="st-ch st-layers">
      <div className="st-layers-list">
        <Up><p className="st-kicker">Try it · pick a layer</p></Up>
        <ul role="tablist" aria-label="Map layer">
          {INDICATORS.map((ind, i) => (
            <motion.li key={ind.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08, duration: 0.7, ease: EASE }}>
              <button role="tab" aria-selected={ind.id === active.id} onClick={() => setActive(ind)} onMouseEnter={() => setActive(ind)}>
                {ind.name}
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div className="st-layers-map" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}>
        <svg viewBox={stateShape.viewBox} role="img" aria-label={`${active.name} by district`}>
          {stateShape.districts.map((d, i) => {
            const v = values.get(d.id);
            const t = v == null ? null : hi === lo ? 0.5 : (v - lo) / (hi - lo);
            return (
              <motion.path key={d.id} d={d.d} initial={{ opacity: 0 }} animate={{ opacity: 1, fill: t == null ? "#1f5163" : mix(active.ramp[0], active.ramp[1], t) }} transition={{ opacity: { delay: 0.3 + i * 0.015 }, fill: { duration: 0.5 } }}>
                <title>{`${d.name}: ${v == null ? "no data yet" : `${v.toFixed(2)} ${active.unit}`}`}</title>
              </motion.path>
            );
          })}
        </svg>
      </motion.div>
      <div className="st-layers-fact" aria-live="polite">
        <h3 className="st-h3">{active.name}</h3>
        <p className="st-body">{active.fact}</p>
        <p className="st-note">
          {!load.data && !load.error
            ? "Loading…"
            : load.error
              ? "Data service offline."
              : values.size
                ? `${values.size} of 36 districts · ${fmtDate(latest)}`
                : "No satellite data stored yet. The map fills in after the first Earth Engine sync."}
        </p>
        {values.size > 0 && (
          <div className="st-ramp" style={{ background: `linear-gradient(90deg, ${active.ramp[0]}, ${active.ramp[1]})` }}>
            <span>{lo.toFixed(1)}</span>
            <span>{hi.toFixed(1)} {active.unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RealChapter({ bounded }: { bounded: number | undefined }) {
  const load = useLoad<IndicatorCollection>("real:rainfall", (s) => getDistrictIndicators("rainfall", undefined, undefined, s));
  const observed = load.data ? load.data.features.filter((f) => f.properties.measured_value != null).length : null;
  const latest = load.data?.features.map((f) => f.properties.observation_date).filter(Boolean).sort().at(-1);
  const cards = [
    { v: <CountUp value={bounded} />, label: "districts mapped with official boundaries", c: "aqua" },
    { v: <CountUp value={observed} />, label: "districts with satellite rainfall stored", c: "pink" },
    { v: <span className="st-real-date">{fmtDate(latest) ?? "Not yet"}</span>, label: "latest satellite month on record", c: "amber" },
  ];
  return (
    <div className="st-ch st-real">
      <div className="st-copy st-wide">
        <Up><p className="st-kicker">What is real today</p></Up>
        <Up i={1}><h2 className="st-h2">Only measured numbers. Nothing made up.</h2></Up>
        <div className="st-real-grid">
          {cards.map((c, i) => (
            <motion.div key={i} className={`st-real-card is-${c.c}`} initial={{ opacity: 0, y: 70, rotate: i === 1 ? 0 : i === 0 ? -2 : 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.4 + i * 0.15 }}>
              <strong>{c.v}</strong>
              <span>{c.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolsChapter() {
  return (
    <div className="st-ch st-tools">
      <motion.div className="st-tools-photo" initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.2, ease: EASE }} aria-hidden />
      <div className="st-copy st-tools-body">
        <Up><p className="st-kicker">What you can do</p></Up>
        <Up i={1}><h2 className="st-h2">Six ways in</h2></Up>
        <div className="st-tools-grid">
          {TOOLS.map((t, i) => (
            <motion.div key={t.href} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.4 + i * 0.08 }}>
              <Link href={t.href} className="st-tool" style={{ ["--c" as string]: t.c }}>
                <StateMark className="st-tool-mark" />
                <strong>{t.title}</strong>
                <span>{t.text}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EndChapter() {
  return (
    <div className="st-ch st-end">
      <Link href="/overview" className="st-cta">
        <motion.span className="st-cta-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          Open the dashboard: map, indices and forecast for every district
        </motion.span>
        <span className="st-line st-cta-line">
          <motion.span className="st-cta-word" initial={{ y: "100%" }} animate={{ y: "0%" }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}>
            Explore →
          </motion.span>
        </span>
      </Link>
      <footer className="st-foot">
        <nav aria-label="All pages">
          <Link href="/overview">Overview</Link>
          <Link href="/map">GIS map</Link>
          <Link href="/predictions">Predictions</Link>
          <Link href="/backtesting">Backtesting</Link>
          <Link href="/coverage">Data coverage</Link>
          <Link href="/methodology">Methodology</Link>
        </nav>
        <p className="st-credits">
          Photos via Wikimedia Commons:{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=59641509">Mariappan Ramachandran</a> (CC BY-SA 4.0),{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=80660305">Albert Deccan</a> (CC BY-SA 3.0),{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=81531846">Phil Bus</a> (CC BY-SA 2.0),{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=18724878">Shakher59</a> (CC BY-SA 3.0),{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=90076337">Rosser1954</a> (CC BY-SA 4.0),{" "}
          <a href="https://commons.wikimedia.org/w/index.php?curid=68017726">Deccan Traps SkySat image by Planet Labs</a> (CC BY-SA 4.0); NASA ISS
          Expedition 62 night photo and Godavari satellite view (public domain).
          Satellite data: CHIRPS, MODIS, ERA5-Land via Google Earth Engine.
        </p>
      </footer>
    </div>
  );
}

/* ---------- the player ---------- */

export function Landing() {
  const reduce = useReducedMotion() ?? false;
  const [intro, setIntro] = useState(true);
  const [[index, dir], setPage] = useState<[number, number]>([0, 1]);
  const lockUntil = useRef(0);
  const wheelAcc = useRef(0);
  const touchY = useRef<number | null>(null);

  const districts = useLoad("districts", (s) => getDistricts(s));
  const ready = useLoad("ready", (s) => getReadiness(s));
  const bounded = districts.data?.items.filter((d) => d.boundary_available).length;
  const status = ready.data?.gee?.available ? "live" : districts.error ? "down" : "offline";

  const go = useCallback((to: number) => {
    const next = Math.max(0, Math.min(CHAPTERS.length - 1, to));
    setPage(([cur]) => (next === cur ? [cur, 1] : [next, next > cur ? 1 : -1]));
  }, []);
  const step = useCallback(
    (d: number) => {
      const now = Date.now();
      if (now < lockUntil.current) return;
      lockUntil.current = now + (reduce ? 400 : LOCK_MS);
      setPage(([cur]) => {
        const next = Math.max(0, Math.min(CHAPTERS.length - 1, cur + d));
        return next === cur ? [cur, d] : [next, d];
      });
    },
    [reduce],
  );

  useEffect(() => {
    document.documentElement.classList.add("st-lock");
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-scroll-inside]")) return;
      e.preventDefault();
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) > 40) {
        step(Math.sign(wheelAcc.current));
        wheelAcc.current = 0;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); step(1); }
      if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); step(-1); }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(CHAPTERS.length - 1);
    };
    const onTouchStart = (e: TouchEvent) => (touchY.current = e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY.current == null) return;
      const dy = touchY.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) step(Math.sign(dy));
      touchY.current = null;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      document.documentElement.classList.remove("st-lock");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [step, go]);

  const chapter = (() => {
    if (index === 0) return <Hero status={status} />;
    if (index <= MONTHS.length) return <MonthChapter idx={index - 1} />;
    const rest = index - MONTHS.length - 1;
    return [<HowChapter key="h" />, <LayersChapter key="l" />, <RealChapter key="r" bounded={bounded} />, <ToolsChapter key="t" />, <EndChapter key="e" />][rest];
  })();

  // Each chapter wipes in from the scroll direction while the previous one sinks back.
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { clipPath: d > 0 ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)", scale: 1.04 }),
    center: reduce ? { opacity: 1 } : { clipPath: "inset(0% 0 0 0)", scale: 1 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0.2, scale: 0.94, y: d > 0 ? "-6%" : "6%" }),
  };

  return (
    <div className="lp st">
      {intro && <TitleSequence onDone={() => setIntro(false)} />}
      <FilmGrain />

      <header className="st-top">
        <button type="button" className="st-brand" onClick={() => go(0)} aria-label="Back to start">
          <StateMark className="st-brand-mark" />
          DroughtLens
        </button>
        <span className="st-counter" aria-live="polite">
          <b>{String(index + 1).padStart(2, "0")}</b> / {CHAPTERS.length} · {CHAPTERS[index]}
        </span>
        <Link href="/overview" className="st-top-cta">Open dashboard</Link>
      </header>

      <main className="st-stage">
        <AnimatePresence initial={false} custom={dir}>
          <motion.section
            key={index}
            className="st-frame"
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0.3 : 1.05, ease: EASE }}
            aria-label={CHAPTERS[index]}
          >
            {chapter}
          </motion.section>
        </AnimatePresence>
      </main>

      <nav className="st-dots" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <button key={c} type="button" onClick={() => go(i)} aria-current={i === index ? "step" : undefined} className={i === index ? "is-on" : ""}>
            <span className="st-dot-label">{c}</span>
            <span className="st-dot-mark" />
          </button>
        ))}
      </nav>
      <motion.div className="st-progress" animate={{ scaleX: (index + 1) / CHAPTERS.length }} transition={{ duration: 0.8, ease: EASE }} aria-hidden />

      <AnimatePresence>
        {index === 0 && !intro && (
          <motion.button type="button" className="st-hint" onClick={() => step(1)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 1.2 }}>
            Scroll to begin <span aria-hidden>↓</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

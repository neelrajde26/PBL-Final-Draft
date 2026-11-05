"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { stateShape } from "@/components/landing/state-mark";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- Film grain + vignette over the whole page ---------- */
export function FilmGrain() {
  return (
    <div className="cn-grain" aria-hidden>
      <svg width="100%" height="100%">
        <filter id="cn-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cn-noise)" />
      </svg>
    </div>
  );
}

/* ---------- Timecode + scrub bar: the page reads like a reel ---------- */
const CHAPTERS = ["Title", "One year", "Pipeline", "Live layers", "Figures", "Tools", "End"];

export function Timecode() {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [tc, setTc] = useState("00:00:00:00");
  const [chapter, setChapter] = useState(CHAPTERS[0]);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const frames = Math.round(p * 150 * 24); // a 2:30 reel at 24 fps
    const f = frames % 24, s = Math.floor(frames / 24) % 60, m = Math.floor(frames / 1440);
    setTc(`00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`);
    setChapter(CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length))]);
  });
  return (
    <>
      <motion.div className="cn-scrub" style={{ scaleX: smooth }} aria-hidden />
      <div className="cn-tc" aria-hidden>
        <span className="cn-rec" /> REC <span className="cn-tc-num">{tc}</span>
        <span className="cn-tc-ch">{chapter}</span>
      </div>
    </>
  );
}

/* ---------- Opening title sequence: letterbox opens, districts draw in ---------- */
export function TitleSequence({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), reduce ? 0 : 3000);
    return () => clearTimeout(t);
  }, [reduce]);
  if (reduce) return null;
  return (
    <motion.div
      className="cn-title"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 2.4, duration: 0.6 }}
      aria-hidden
    >
      <motion.div className="cn-bar cn-bar-top" initial={{ height: "50vh" }} animate={{ height: "9vh" }} transition={{ duration: 1.1, ease: EASE }} />
      <motion.div className="cn-bar cn-bar-bot" initial={{ height: "50vh" }} animate={{ height: "9vh" }} transition={{ duration: 1.1, ease: EASE }} />
      <svg viewBox={stateShape.viewBox} className="cn-title-map">
        {stateShape.districts.map((d, i) => (
          <motion.path
            key={d.id}
            d={d.d}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.3, delay: 0.5 + i * 0.022, ease: "easeInOut" }}
          />
        ))}
      </svg>
      <motion.p className="cn-title-text" initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.28em" }} transition={{ delay: 1.1, duration: 1.2, ease: EASE }}>
        DROUGHTLENS · MAHARASHTRA
      </motion.p>
    </motion.div>
  );
}

/* ---------- Rain: canvas streaks whose intensity follows a motion value ---------- */
export function Rain({ intensity, className }: { intensity: MotionValue<number>; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const c = ref.current;
    if (!c || reduce) return;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0, visible = true;
    const drops = Array.from({ length: 420 }, () => ({ x: Math.random(), y: Math.random(), l: 0.4 + Math.random() * 0.8, v: 0.6 + Math.random() * 0.8 }));
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = c.width = r.width * devicePixelRatio;
      h = c.height = r.height * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(c);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const k = intensity.get();
      ctx.clearRect(0, 0, w, h);
      if (k <= 0.01) return;
      const n = Math.floor(drops.length * k);
      ctx.strokeStyle = "rgba(200,245,236,0.55)";
      ctx.lineWidth = 1.2 * devicePixelRatio;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y += 0.018 * d.v;
        d.x -= 0.003 * d.v;
        if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.1; }
        const x = d.x * w, y = d.y * h, len = 26 * d.l * devicePixelRatio;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.18, y + len);
      }
      ctx.stroke();
    };
    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [intensity, reduce]);
  return <canvas ref={ref} className={className} aria-hidden />;
}

/* ---------- Count up when the figure enters view ---------- */
export function CountUp({ value, className }: { value: number | null | undefined; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const mv = useMotionValue(0);
  const [shown, setShown] = useState("0");
  useMotionValueEvent(mv, "change", (v) => setShown(String(Math.round(v))));
  useEffect(() => {
    if (!inView || value == null) return;
    const c = animate(mv, value, { duration: 1.6, ease: EASE });
    return () => c.stop();
  }, [inView, value, mv]);
  return <span ref={ref} className={className}>{value == null ? "—" : shown}</span>;
}

/* ---------- Scene 1: one year over Maharashtra, pinned and scrubbed by scroll ---------- */
const MONTHS = [
  { m: "June", title: "The monsoon breaks on the Ghats", text: "Most of the year's rain arrives in four months. When it comes late, everything downstream is late.", img: "/media/ghats-monsoon.jpg", rain: 1, tint: "#2fd6c0" },
  { m: "August", title: "Fields turn green", text: "Kharif crops come up. Satellites see it as a rising vegetation index, district by district.", img: "/media/turmeric-farm.jpg", rain: 0.45, tint: "#7cf06b" },
  { m: "November", title: "Harvest, then the plough", text: "The soil still holds the monsoon. How much it holds decides the rabi season.", img: "/media/ploughing.jpg", rain: 0, tint: "#ffb547" },
  { m: "March", title: "The rivers thin out", text: "By spring the Godavari runs over bare rock at Puntamba. Reservoirs fall week by week.", img: "/media/godavari-puntamba.jpg", rain: 0, tint: "#ff7a59" },
  { m: "May", title: "The ground cracks", text: "Heat peaks before the rain returns. This is the gap DroughtLens watches.", img: "/media/cracked-earth.jpg", rain: 0, tint: "#ff4f7b" },
];

export function YearScene() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const n = MONTHS.length;
  const idxMv = useTransform(scrollYProgress, (p) => Math.min(n - 1, Math.max(0, p * n)));
  const [idx, setIdx] = useState(0);
  useMotionValueEvent(idxMv, "change", (v) => setIdx(Math.floor(v)));
  const rain = useTransform(scrollYProgress, [0, 0.12, 0.28, 0.4], [1, 1, 0.4, 0]);
  const heat = useTransform(scrollYProgress, [0.55, 1], [0, 1]);
  const heatBlur = useTransform(heat, (h) => `blur(${h * 0.6}px) saturate(${1 + h * 0.5}) contrast(${1 + h * 0.15})`);
  const rail = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const cur = MONTHS[idx];

  return (
    <section ref={ref} className="cn-year" style={{ height: `${n * 100 + 60}vh` }} aria-label="One year over Maharashtra">
      <div className="cn-year-stage">
        {MONTHS.map((mo, i) => (
          <motion.div
            key={mo.m}
            className="cn-year-img"
            style={{ backgroundImage: `url(${mo.img})`, filter: i >= 3 ? heatBlur : undefined }}
            initial={false}
            animate={{ opacity: i === idx ? 1 : 0, scale: i === idx ? 1.08 : 1.2 }}
            transition={{ opacity: { duration: 0.9 }, scale: { duration: 6, ease: "linear" } }}
            role="img"
            aria-label={mo.title}
          />
        ))}
        <motion.div className="cn-year-tint" animate={{ backgroundColor: cur.tint }} transition={{ duration: 0.9 }} />
        <div className="cn-year-shade" />
        <Rain intensity={rain} className="cn-rain" />
        <motion.div className="cn-heat" style={{ opacity: heat }} />

        <div className="cn-year-copy">
          <p className="cn-eyebrow">One year over Maharashtra</p>
          <div className="cn-month-wrap">
            <motion.h2 key={cur.m} className="cn-month" initial={{ y: "100%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} transition={{ duration: 0.7, ease: EASE }}>
              {cur.m}
            </motion.h2>
          </div>
          <motion.div key={cur.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}>
            <h3 className="cn-year-title">{cur.title}</h3>
            <p className="cn-year-text">{cur.text}</p>
          </motion.div>
        </div>

        <div className="cn-rail" aria-hidden>
          <motion.div className="cn-rail-fill" style={{ width: rail, background: cur.tint }} />
          {MONTHS.map((mo, i) => (
            <span key={mo.m} className={i <= idx ? "is-on" : ""} style={{ left: `${(i / (n - 1)) * 100}%` }}>
              {mo.m.slice(0, 3)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Scene 2: the pipeline as a horizontal track, pinned ---------- */
const STAGES = [
  { n: "01", name: "Observe", text: "Earth Engine pulls CHIRPS rainfall, MODIS vegetation and heat, and ERA5-Land soil water for every district.", img: "/media/ghats-monsoon.jpg", color: "#54d6bd" },
  { n: "02", name: "Measure", text: "Pixels become SPI, VCI, TCI and VHI: the drought indices officers already read.", img: "/media/turmeric-farm.jpg", color: "#7cf06b" },
  { n: "03", name: "Forecast", text: "A model trained on past seasons estimates next month's risk, scored only on years it never saw.", img: "/media/ploughing.jpg", color: "#ffb547" },
  { n: "04", name: "Warn", text: "Cross a threshold and the district gets an alert in Marathi and English, with the measurement beside it.", img: "/media/cracked-earth.jpg", color: "#f4bbd0" },
];

export function PipelineScene() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "-75%"]);
  const lineW = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "100%"]);
  return (
    <section ref={ref} id="how" className="cn-pipe" aria-label="How it works">
      <div className="cn-pipe-stage">
        <div className="cn-pipe-head">
          <h2 className="lp-h2">From pixel to warning</h2>
          <div className="cn-pipe-line"><motion.span style={{ width: lineW }} /></div>
        </div>
        <motion.div className="cn-pipe-track" style={{ x }}>
          {STAGES.map((s) => (
            <article key={s.n} className="cn-panel" style={{ ["--c" as string]: s.color }}>
              <div className="cn-panel-img" style={{ backgroundImage: `url(${s.img})` }} />
              <div className="cn-panel-body">
                <span className="cn-panel-n">{s.n}</span>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Text that wipes in word by word as it scrolls past ---------- */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word key={i} p={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </Word>
      ))}
    </p>
  );
}
function Word({ children, p, range }: { children: string; p: MotionValue<number>; range: [number, number] }) {
  const o = useTransform(p, range, [0.18, 1]);
  const y = useTransform(p, range, [8, 0]);
  return (
    <motion.span style={{ opacity: o, y, display: "inline-block", marginRight: "0.28em" }}>{children}</motion.span>
  );
}

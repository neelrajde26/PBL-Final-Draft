"use client";

import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, type MotionValue } from "motion/react";
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

/* ---------- Opening title sequence: letterbox opens, districts draw in ---------- */
export function TitleSequence({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
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
  const inView = useInView(ref, { once: true });
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


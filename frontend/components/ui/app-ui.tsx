"use client";

import { motion } from "motion/react";
import Link from "next/link";

const EASE = [0.22, 1, 0.36, 1] as const;

/** What kind of number this is. Every figure on an app screen carries one. */
export type Provenance = "observed" | "historical" | "derived" | "predicted" | "backtest" | "unavailable";

const PROV_LABEL: Record<Provenance, string> = {
  observed: "Observed",
  historical: "Historical record",
  derived: "Derived index",
  predicted: "ML forecast",
  backtest: "Backtest",
  unavailable: "Awaiting data",
};

export function ProvBadge({ kind }: { kind: Provenance }) {
  return <span className={`ap-prov ap-prov-${kind}`}>{PROV_LABEL[kind]}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  image,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  image?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="ap-head">
      {image && (
        <motion.div
          className="ap-head-img"
          style={{ backgroundImage: `url(${image})` }}
          initial={{ scale: 1.12, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
          aria-hidden
        />
      )}
      <div className="ap-head-inner">
        <motion.p className="ap-eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          {eyebrow}
        </motion.p>
        <h1 className="ap-title">
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "70%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
          >
            {title}
          </motion.span>
        </h1>
        {lead && (
          <motion.p className="ap-lead" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}>
            {lead}
          </motion.p>
        )}
        {children && (
          <motion.div className="ap-head-tools" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}>
            {children}
          </motion.div>
        )}
      </div>
    </header>
  );
}

export function Panel({
  title,
  note,
  prov,
  action,
  className,
  children,
  delay = 0,
}: {
  title?: string;
  note?: string;
  prov?: Provenance;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      className={`ap-panel ${className ?? ""}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-6% 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {(title || action || prov) && (
        <div className="ap-panel-head">
          <div>
            {title && <h2 className="ap-panel-title">{title}</h2>}
            {note && <p className="ap-panel-note">{note}</p>}
          </div>
          <div className="ap-panel-tools">
            {prov && <ProvBadge kind={prov} />}
            {action}
          </div>
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "plain",
  prov,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "plain" | "aqua" | "pink" | "amber" | "coral";
  prov?: Provenance;
  delay?: number;
}) {
  return (
    <motion.div
      className={`ap-kpi ap-kpi-${tone}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      <div className="ap-kpi-top">
        <span className="ap-kpi-label">{label}</span>
        {prov && <ProvBadge kind={prov} />}
      </div>
      <strong className="ap-kpi-value">{value}</strong>
      {sub && <span className="ap-kpi-sub">{sub}</span>}
    </motion.div>
  );
}

/** Empty state that says exactly what is missing and how it gets filled. */
export function Awaiting({ what, how, href }: { what: string; how: string; href?: string }) {
  return (
    <div className="ap-empty">
      <svg viewBox="0 0 48 48" className="ap-empty-icon" aria-hidden>
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
        <path d="M24 14v12l7 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="ap-empty-what">{what}</p>
      <p className="ap-empty-how">{how}</p>
      {href && (
        <Link href={href} className="ap-btn ap-btn-ghost">
          See data status
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ h = 160 }: { h?: number }) {
  return <div className="ap-skel" style={{ height: h }} aria-busy="true" aria-label="Loading" />;
}

export function fmtDate(iso?: string | null, withYear = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

export function fmtPct(v?: number | null, digits = 0) {
  return v == null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

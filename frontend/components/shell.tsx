"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Cpu,
  Database,
  FlaskConical,
  History,
  Map,
  MapPin,
  Menu,
  Satellite,
  ShieldCheck,
  Sliders,
  Sprout,
  TrendingUp,
  User as UserIcon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { StateMark } from "@/components/landing/state-mark";
import { getDistricts, getGeeJobs, getReadiness, type District, type Readiness } from "@/lib/api";
import { storeDistrict, useStoredDistrict } from "@/lib/use-load";
import { useI18n } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  group: "monitor" | "forecast" | "portals" | "about";
};

const navItems: NavItem[] = [
  { href: "/overview", labelKey: "nav.overview", icon: Activity, group: "monitor" },
  { href: "/map", labelKey: "nav.gisMap", icon: Map, group: "monitor" },
  { href: "/districts", labelKey: "nav.districts", icon: MapPin, group: "monitor" },
  { href: "/indices", labelKey: "nav.indices", icon: Sliders, group: "monitor" },
  { href: "/alerts", labelKey: "nav.alerts", icon: AlertTriangle, group: "monitor" },

  { href: "/predictions", labelKey: "nav.forecasting", icon: TrendingUp, group: "forecast" },
  { href: "/backtesting", labelKey: "nav.backtesting", icon: FlaskConical, group: "forecast" },
  { href: "/models", labelKey: "nav.models", icon: Cpu, group: "forecast" },
  { href: "/historical", labelKey: "nav.historical", icon: History, group: "forecast" },

  { href: "/farmer", labelKey: "nav.farmerPortal", icon: Sprout, group: "portals" },
  { href: "/researcher", labelKey: "nav.researcherHub", icon: BarChart3, group: "portals" },
  { href: "/admin", labelKey: "nav.adminConsole", icon: ShieldCheck, group: "portals" },

  { href: "/coverage", labelKey: "nav.coverage", icon: Database, group: "about" },
  { href: "/data-sources", labelKey: "nav.dataSources", icon: Satellite, group: "about" },
  { href: "/methodology", labelKey: "nav.methodology", icon: BookOpen, group: "about" },
];

const AUTH_ROUTES = new Set(["/login", "/register", "/forgot-password"]);

const GROUPS: { key: NavItem["group"]; en: string; mr: string }[] = [
  { key: "monitor", en: "Monitor", mr: "निरीक्षण" },
  { key: "forecast", en: "Forecast & evaluate", mr: "अंदाज व मूल्यमापन" },
  { key: "portals", en: "Portals", mr: "पोर्टल्स" },
  { key: "about", en: "Data & method", mr: "डेटा व पद्धत" },
];

function timeAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { language, setLanguage, t } = useI18n();

  const [menuOpen, setMenuOpen] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const saved = useStoredDistrict();
  const district = params.get("district") || saved || "beed";

  useEffect(() => {
    const ctrl = new AbortController();
    const fail = () => !ctrl.signal.aborted && setApiDown(true);
    getReadiness(ctrl.signal).then(setReadiness).catch(() => {});
    getDistricts(ctrl.signal).then((r) => setDistricts(r.items)).catch(fail);
    getGeeJobs(ctrl.signal).then((j) => setLastSync(j.last_success)).catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (pathname === "/") return <>{children}</>;
  if (AUTH_ROUTES.has(pathname)) {
    return (
      <div className="au">
        <aside className="au-art" aria-hidden>
          <motion.div className="au-photo" initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }} />
          <motion.div className="au-shape" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.3 }}>
            <StateMark className="au-mark" />
          </motion.div>
          <div className="au-quote">
            <p>Drought, seen early.</p>
            <span>Satellite drought warnings for all 36 districts of Maharashtra.</span>
          </div>
        </aside>
        <div className="au-main">
          <Link href="/" className="au-brand"><StateMark className="sh-mark" /> DroughtLens</Link>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
            {children}
          </motion.div>
          <Link href="/overview" className="au-skip">Continue without signing in →</Link>
        </div>
      </div>
    );
  }

  const chooseDistrict = (id: string) => {
    storeDistrict(id);
    const q = new URLSearchParams(params.toString());
    q.set("district", id);
    router.push(`${pathname}?${q.toString()}`);
  };

  const geeLive = readiness?.gee?.available === true;
  const status = apiDown ? "down" : !readiness ? "checking" : geeLive ? "live" : "offline";

  return (
    <div className="sh">
      <header className="sh-top">
        <button type="button" className="sh-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href="/" className="sh-brand">
          <StateMark className="sh-mark" />
          <span>
            <strong>DroughtLens</strong>
            <small>{language === "mr" ? "महाराष्ट्र दुष्काळ गुप्तचर प्रणाली" : "Maharashtra Drought Intelligence"}</small>
          </span>
        </Link>

        <div className="sh-tools">
          <label className="sh-district">
            <MapPin size={16} aria-hidden />
            <span className="sr-only">District</span>
            <select value={district} onChange={(e) => chooseDistrict(e.target.value)}>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="sh-lang" role="group" aria-label="Language">
            <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
              EN
            </button>
            <button type="button" aria-pressed={language === "mr"} onClick={() => setLanguage("mr")}>
              मराठी
            </button>
          </div>

          <Link href="/admin" className={`sh-status is-${status}`} title={readiness?.gee?.message ?? undefined}>
            <span className="sh-dot" />
            <span className="sh-status-text">
              {status === "live" ? "Earth Engine live" : status === "offline" ? "Earth Engine offline" : status === "down" ? "API unreachable" : "Checking…"}
              <small>{lastSync ? `Last sync ${timeAgo(lastSync)}` : "No successful sync yet"}</small>
            </span>
          </Link>

          <Link href="/login" className="sh-account" aria-label={t("nav.account")}>
            <UserIcon size={18} />
          </Link>
        </div>
      </header>

      <div className="sh-body">
        <aside className={`sh-side ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          <nav>
            {GROUPS.map((g) => (
              <div key={g.key} className="sh-group">
                <p className="sh-group-label">{language === "mr" ? g.mr : g.en}</p>
                {navItems
                  .filter((i) => i.group === g.key)
                  .map(({ href, labelKey, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`sh-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
                        {active && <motion.span layoutId="sh-pill" className="sh-pill" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                        <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                        <span>{t(labelKey)}</span>
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>
          <div className="sh-side-foot">
            <span>GEE project</span>
            <strong>{readiness?.gee?.project_id ?? "—"}</strong>
            <span>Database {readiness?.database?.available ? "connected" : "not running (file store)"}</span>
          </div>
        </aside>
        {menuOpen && <div className="sh-scrim" onClick={() => setMenuOpen(false)} aria-hidden />}

        <main className="sh-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}

/** The district chosen in the top bar, read from the URL or the last choice. */
export function useSelectedDistrict(fallback = "beed") {
  const params = useSearchParams();
  const saved = useStoredDistrict();
  return params.get("district") || saved || fallback;
}

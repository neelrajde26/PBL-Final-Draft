"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Cpu,
  History,
  Map,
  MapPin,
  Satellite,
  ShieldCheck,
  Sliders,
  Sprout,
  TrendingUp,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getReadiness, type Readiness } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  group?: "core" | "analysis" | "roles" | "info";
};

const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: Activity, group: "core" },
  { href: "/map", label: "GIS Map", icon: Map, group: "core" },
  { href: "/districts", label: "Districts", icon: MapPin, group: "core" },
  { href: "/indices", label: "Drought Indices", icon: Sliders, group: "analysis" },
  { href: "/predictions", label: "Forecasting", icon: TrendingUp, group: "analysis" },
  { href: "/models", label: "ML Models", icon: Cpu, group: "analysis" },
  { href: "/historical", label: "Historical", icon: History, group: "analysis" },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle, group: "analysis" },
  { href: "/farmer", label: "Farmer Portal", icon: Sprout, group: "roles" },
  { href: "/researcher", label: "Researcher Hub", icon: BarChart3, group: "roles" },
  { href: "/admin", label: "Admin Console", icon: ShieldCheck, group: "roles" },
  { href: "/satellite", label: "Satellite Sources", icon: Satellite, group: "info" },
  { href: "/methodology", label: "Methodology", icon: BookOpen, group: "info" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    let active = true;
    getReadiness()
      .then((data) => {
        if (active) setReadiness(data);
      })
      .catch(() => {
        if (active) setReadiness(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        <Link className="brand-mark" href="/" aria-label="MDIS home" title="Maharashtra Drought Intelligence System">
          <span>MH</span>
        </Link>
        <nav className="rail-nav">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`rail-action${isActive ? " active" : ""}`}
                title={label}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                <span className="rail-label">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="rail-utils" title="Service Readiness">
          <Link href="/login" className="rail-action" title="Account / Login">
            <User size={18} strokeWidth={1.7} />
            <span className="rail-label">Account</span>
          </Link>
          <div
            className={`status-dot ${readiness?.status === "ready" ? "ready" : "offline"}`}
            title={`API: ${readiness?.status ?? "Checking"} | GEE: ${readiness?.gee.status ?? "Offline"}`}
          />
        </div>
      </aside>
      <div className="shell-body">{children}</div>
    </div>
  );
}

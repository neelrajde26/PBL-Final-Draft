"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Cpu,
  Globe,
  History,
  Languages,
  Layers,
  LogOut,
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
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getDistricts, getReadiness, type District, type Readiness } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  group: "operational" | "analysis" | "portals" | "resources";
  badge?: string;
};

const navItems: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Activity, group: "operational" },
  { href: "/map", labelKey: "nav.gisMap", icon: Map, group: "operational" },
  { href: "/districts", labelKey: "nav.districts", icon: MapPin, group: "operational" },

  { href: "/indices", labelKey: "nav.indices", icon: Sliders, group: "analysis" },
  { href: "/predictions", labelKey: "nav.forecasting", icon: TrendingUp, group: "analysis" },
  { href: "/models", labelKey: "nav.models", icon: Cpu, group: "analysis" },
  { href: "/historical", labelKey: "nav.historical", icon: History, group: "analysis" },
  { href: "/alerts", labelKey: "nav.alerts", icon: AlertTriangle, group: "analysis" },

  { href: "/farmer", labelKey: "nav.farmerPortal", icon: Sprout, group: "portals", badge: "Live" },
  { href: "/researcher", labelKey: "nav.researcherHub", icon: BarChart3, group: "portals" },
  { href: "/admin", labelKey: "nav.adminConsole", icon: ShieldCheck, group: "portals" },

  { href: "/satellite", labelKey: "nav.satellites", icon: Satellite, group: "resources" },
  { href: "/methodology", labelKey: "nav.methodology", icon: BookOpen, group: "resources" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("beed");

  useEffect(() => {
    let active = true;
    getReadiness()
      .then((data) => {
        if (active) setReadiness(data);
      })
      .catch(() => {
        if (active) setReadiness(null);
      });

    getDistricts()
      .then((res) => {
        if (active) setDistricts(res.items);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedDistrict(val);
    if (pathname === "/map" || pathname === "/districts") {
      router.push(`${pathname}?district=${val}`);
    } else if (pathname.startsWith("/farmer")) {
      router.push(`/farmer?district=${val}`);
    }
  };

  const groups: { key: NavItem["group"]; labelEn: string; labelMr: string }[] = [
    { key: "operational", labelEn: "OPERATIONAL", labelMr: "कार्यप्रणाली" },
    { key: "analysis", labelEn: "SCIENTIFIC ANALYSIS", labelMr: "वैज्ञानिक विश्लेषण" },
    { key: "portals", labelEn: "USER PORTALS", labelMr: "पोर्टल्स" },
    { key: "resources", labelEn: "RESOURCES", labelMr: "माहिती व स्रोत" },
  ];

  return (
    <div className="min-h-screen bg-[var(--ground)] text-[var(--text)] flex flex-col">
      {/* 64px Top Bar (Ruled T-Frame) */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--ground)] sticky top-0 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 rounded lg:hidden text-[var(--secondary)] hover:text-[var(--text)]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="flex items-center gap-2.5 text-decoration-none">
            <span className="w-8 h-8 rounded bg-[var(--surface)] border border-[var(--aqua)] text-[var(--aqua)] flex items-center justify-center font-mono font-bold text-xs tracking-wider">
              MH
            </span>
            <div className="hidden sm:block">
              <span className="font-semibold text-sm tracking-tight text-[var(--text)] block leading-none">
                MDIS
              </span>
              <span className="text-[11px] text-[var(--subtle)] font-normal leading-tight block">
                {language === "mr" ? "महाराष्ट्र दुष्काळ गुप्तचर प्रणाली" : "Maharashtra Drought Intelligence"}
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Right controls: District Selector, Language Switcher, Telemetry, Auth */}
        <div className="flex items-center gap-3">
          {/* District Quick Select */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--secondary)] bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1.5 rounded">
            <MapPin size={13} className="text-[var(--aqua)]" />
            <select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              className="bg-transparent border-none text-[var(--text)] focus:outline-none cursor-pointer pr-2 font-medium"
              aria-label={t("farmer.selectDistrict")}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id} className="bg-[var(--surface)] text-[var(--text)]">
                  {d.name} ({d.region})
                </option>
              ))}
            </select>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setLanguage("mr")}
              className={`px-2 py-1 rounded transition-colors ${
                language === "mr"
                  ? "bg-[var(--raised)] text-[var(--aqua)] font-semibold shadow-xs"
                  : "text-[var(--secondary)] hover:text-[var(--text)]"
              }`}
              title="मराठी भाषा निवडा"
            >
              मराठी
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2 py-1 rounded transition-colors ${
                language === "en"
                  ? "bg-[var(--raised)] text-[var(--aqua)] font-semibold shadow-xs"
                  : "text-[var(--secondary)] hover:text-[var(--text)]"
              }`}
              title="Select English Language"
            >
              EN
            </button>
          </div>

          {/* Infrastructure Health Badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border border-[var(--border)] bg-[var(--surface)]"
            title={`API: ${readiness?.status ?? "active"} | GEE: ${readiness?.gee?.available ? "connected" : "configured"} | DB: ${readiness?.database?.available ? "connected" : "offline"}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                readiness?.status === "ready" ? "bg-[var(--aqua)] animate-pulse" : "bg-emerald-400"
              }`}
            />
            <span className="text-[var(--secondary)] font-sans">{t("app.live")}</span>
          </div>

          {/* Account Profile Link */}
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)] text-xs text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
            title="User Profile / Login"
          >
            <UserIcon size={14} className="text-[var(--aqua)]" />
            <span className="hidden md:inline">{t("nav.account")}</span>
          </Link>
        </div>
      </header>

      {/* T-Frame Body */}
      <div className="flex flex-1">
        {/* 230px Ruled Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 z-30 w-[230px] h-[calc(100vh-64px)] bg-[var(--ground)] border-r border-[var(--border)] flex flex-col justify-between overflow-y-auto transition-transform lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Main Navigation"
        >
          <nav className="p-3 space-y-5">
            {groups.map((group) => {
              const items = navItems.filter((i) => i.group === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="space-y-1">
                  <div className="px-2 text-[10px] font-mono font-semibold text-[var(--subtle)] tracking-wider">
                    {language === "mr" ? group.labelMr : group.labelEn}
                  </div>
                  {items.map(({ href, labelKey, icon: Icon, badge }) => {
                    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors ${
                          isActive
                            ? "bg-[var(--raised)] text-[var(--aqua)] font-semibold border-l-2 border-[var(--aqua)]"
                            : "text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} strokeWidth={isActive ? 2 : 1.7} />
                          <span>{t(labelKey)}</span>
                        </div>
                        {badge && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer Metadata */}
          <div className="p-3 border-t border-[var(--border)] text-[11px] text-[var(--subtle)] font-mono space-y-1">
            <div className="flex justify-between items-center">
              <span>PROJ: gee-pbl</span>
              <span className="text-[var(--aqua)]">v1.0.0</span>
            </div>
            <div>36 Districts Active</div>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Main Content Pane */}
        <main className="flex-1 min-w-0 bg-[var(--ground)] overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

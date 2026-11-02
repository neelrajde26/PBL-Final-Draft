"use client";

import type { FeatureCollection, MultiPolygon } from "geojson";
import {
  Filter,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Map, type MapLayerMouseEvent } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getDistrictBoundaries,
  getDistrictIndicators,
  type DistrictBoundaryCollection,
  type IndicatorCollection,
  type MapLayer,
} from "@/lib/api";

type Props = {
  initialLayer?: string;
  selectedDistrictId?: string;
  onDistrictSelect?: (districtId: string) => void;
  layers: MapLayer[];
};

const MAHARASHTRA_BOUNDS: [[number, number], [number, number]] = [
  [72.55, 15.55],
  [80.95, 22.15],
];

export function GisMap({
  initialLayer = "rainfall",
  selectedDistrictId = "beed",
  onDistrictSelect,
  layers,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const onDistrictSelectRef = useRef(onDistrictSelect);

  useEffect(() => {
    onDistrictSelectRef.current = onDistrictSelect;
  }, [onDistrictSelect]);

  const [activeLayerId, setActiveLayerId] = useState(initialLayer);
  const [selectedId, setSelectedId] = useState(selectedDistrictId);
  const selectedIdRef = useRef(selectedDistrictId);
  const [hoveredProps, setHoveredProps] = useState<Record<string, unknown> | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");

  const [boundaries, setBoundaries] = useState<DistrictBoundaryCollection | null>(null);
  const [indicatorData, setIndicatorData] = useState<IndicatorCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? layers[0],
    [layers, activeLayerId],
  );

  // Load boundaries and indicator data
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [boundRes, indRes] = await Promise.all([
          getDistrictBoundaries(),
          getDistrictIndicators(activeLayerId),
        ]);
        if (!active) return;
        setBoundaries(boundRes);
        setIndicatorData(indRes);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load GIS data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [activeLayerId]);

  // Selected district properties
  const selectedFeature = useMemo(() => {
    if (!indicatorData) return null;
    return indicatorData.features.find((f) => f.properties.district_id === selectedId) ?? null;
  }, [indicatorData, selectedId]);

  // Regions list
  const regions = useMemo(() => {
    if (!indicatorData) return ["All"];
    const set = new Set<string>();
    indicatorData.features.forEach((f) => {
      if (f.properties.region) set.add(f.properties.region);
    });
    return ["All", ...Array.from(set).sort()];
  }, [indicatorData]);

  // Filtered features based on region and search query
  const filteredDistrictIds = useMemo(() => {
    if (!indicatorData) return new Set<string>();
    const ids = new Set<string>();
    indicatorData.features.forEach((f) => {
      const matchRegion = selectedRegion === "All" || f.properties.region === selectedRegion;
      const matchSearch =
        !searchQuery.trim() ||
        f.properties.district_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.properties.district_code.toLowerCase().includes(searchQuery.toLowerCase());
      if (matchRegion && matchSearch) {
        ids.add(f.properties.district_id);
      }
    });
    return ids;
  }, [indicatorData, selectedRegion, searchQuery]);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !boundaries) return;

    const map = new Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#071D2C" },
          },
        ],
      },
      center: [76.5, 19.1],
      zoom: 5.6,
      minZoom: 4.8,
      maxZoom: 9.5,
      attributionControl: false,
    });

    map.on("load", () => {
      map.addSource("districts", {
        type: "geojson",
        data: boundaries as unknown as FeatureCollection<MultiPolygon>,
      });

      map.addLayer({
        id: "districts-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "district_id"], selectedIdRef.current],
            "#F4BBD0",
            ["==", ["get", "district_id"], "beed"],
            "#54D6BD",
            "#193B4A",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "district_id"], selectedIdRef.current],
            0.85,
            0.55,
          ],
        },
      });

      map.addLayer({
        id: "districts-outline",
        type: "line",
        source: "districts",
        paint: {
          "line-color": "#28505C",
          "line-width": 1.2,
          "line-opacity": 0.8,
        },
      });

      map.addLayer({
        id: "districts-highlight",
        type: "line",
        source: "districts",
        filter: ["==", ["get", "district_id"], ""],
        paint: {
          "line-color": "#54D6BD",
          "line-width": 2.2,
        },
      });

      map.on("click", "districts-fill", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.district_id;
        if (typeof id === "string") {
          setSelectedId(id);
          onDistrictSelectRef.current?.(id);
        }
      });

      map.on("mousemove", "districts-fill", (e: MapLayerMouseEvent) => {
        const feat = e.features?.[0];
        if (feat && feat.properties) {
          map.getCanvas().style.cursor = "pointer";
          setHoveredProps(feat.properties);
          setHoverPos({ x: e.point.x, y: e.point.y });
          map.setFilter("districts-highlight", ["==", ["get", "district_id"], feat.properties.district_id]);
        }
      });

      map.on("mouseleave", "districts-fill", () => {
        map.getCanvas().style.cursor = "";
        setHoveredProps(null);
        setHoverPos(null);
        map.setFilter("districts-highlight", ["==", ["get", "district_id"], ""]);
      });

      map.fitBounds(MAHARASHTRA_BOUNDS, { padding: 40, duration: 0 });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [boundaries]);

  // Update styles on selectedId or activeLayer change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("districts-fill")) return;

    map.setPaintProperty("districts-fill", "fill-color", [
      "case",
      ["==", ["get", "district_id"], selectedId],
      "#F4BBD0",
      ["in", ["get", "district_id"], ["literal", Array.from(filteredDistrictIds)]],
      "#54D6BD",
      "#102C3C",
    ]);

    map.setPaintProperty("districts-fill", "fill-opacity", [
      "case",
      ["==", ["get", "district_id"], selectedId],
      0.85,
      ["in", ["get", "district_id"], ["literal", Array.from(filteredDistrictIds)]],
      0.55,
      0.2,
    ]);
  }, [selectedId, filteredDistrictIds]);

  const resetView = () => {
    mapRef.current?.fitBounds(MAHARASHTRA_BOUNDS, { padding: 40, duration: 600 });
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className="gis-wrapper" style={{ position: "relative", width: "100%", height: "100%", display: "flex" }}>
      {/* Map Main Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: "560px" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "560px", background: "#071D2C" }} />

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(7, 29, 44, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#54D6BD",
              fontSize: "13px",
              zIndex: 20,
            }}
          >
            <RefreshCw className="animate-spin" size={18} style={{ marginRight: "8px" }} />
            Loading Maharashtra spatial indicators…
          </div>
        )}

        {/* Spatial error overlay */}
        {error && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              zIndex: 10,
              background: "#102C3C",
              border: "1px solid #EF4444",
              borderRadius: "4px",
              padding: "8px 14px",
              fontSize: "12px",
              color: "#EF4444",
            }}
          >
            {error}
          </div>
        )}

        {/* Top Floating Controls */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Layer Selector */}
          <div
            style={{
              background: "#102C3C",
              border: "1px solid #28505C",
              borderRadius: "4px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Layers size={14} color="#54D6BD" />
            <select
              value={activeLayerId}
              onChange={(e) => setActiveLayerId(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#EAF4F3",
                fontSize: "12px",
                fontWeight: 500,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id} style={{ background: "#102C3C", color: "#EAF4F3" }}>
                  {l.name} ({l.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div
            style={{
              background: "#102C3C",
              border: "1px solid #28505C",
              borderRadius: "4px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Filter size={14} color="#A5BEC3" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#EAF4F3",
                fontSize: "12px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {regions.map((r) => (
                <option key={r} value={r} style={{ background: "#102C3C", color: "#EAF4F3" }}>
                  {r === "All" ? "All Regions" : r}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div
            style={{
              background: "#102C3C",
              border: "1px solid #28505C",
              borderRadius: "4px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Search size={14} color="#78959D" />
            <input
              type="text"
              placeholder="Search district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#EAF4F3",
                fontSize: "12px",
                outline: "none",
                width: "120px",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: "#78959D", cursor: "pointer", padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Map Viewport Tools (Top Right) */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In"
            style={{
              width: "32px",
              height: "32px",
              background: "#102C3C",
              border: "1px solid #28505C",
              borderRadius: "4px",
              color: "#EAF4F3",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out"
            style={{
              width: "32px",
              height: "32px",
              background: "#102C3C",
              border: "1px solid #28505C",
              borderRadius: "4px",
              color: "#EAF4F3",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset View"
            style={{
              width: "32px",
              height: "32px",
              background: "#102C3C",
              border: "1px solid #28505C",
              borderRadius: "4px",
              color: "#EAF4F3",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Hover Tooltip */}
        {hoveredProps && hoverPos && (
          <div
            style={{
              position: "absolute",
              left: hoverPos.x + 12,
              top: hoverPos.y - 24,
              zIndex: 30,
              background: "#102C3C",
              border: "1px solid #54D6BD",
              borderRadius: "4px",
              padding: "6px 10px",
              color: "#EAF4F3",
              fontSize: "12px",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <strong style={{ display: "block", color: "#54D6BD" }}>
              {String(hoveredProps.district_name ?? hoveredProps.district_id ?? "District")}
            </strong>
            <span style={{ color: "#A5BEC3", fontSize: "11px" }}>
              {String(hoveredProps.region ?? "Maharashtra")}
            </span>
          </div>
        )}

        {/* Floating Legend (Bottom Left) */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: 10,
            background: "#102C3C",
            border: "1px solid #28505C",
            borderRadius: "4px",
            padding: "8px 12px",
            fontSize: "11px",
            maxWidth: "280px",
          }}
        >
          <div style={{ fontWeight: 600, color: "#EAF4F3", marginBottom: "4px" }}>
            {activeLayer.name} ({activeLayer.unit})
          </div>
          <div style={{ display: "flex", gap: "2px", height: "8px", borderRadius: "2px", overflow: "hidden", marginBottom: "4px" }}>
            {activeLayer.palette.map((color, idx) => (
              <div key={idx} style={{ flex: 1, background: color }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#78959D", fontSize: "10px" }}>
            <span>{activeLayer.min}</span>
            <span>Source: {activeLayer.source}</span>
            <span>{activeLayer.max}</span>
          </div>
        </div>
      </div>

      {/* District Detail Drawer (Right side) */}
      <aside
        style={{
          width: "320px",
          background: "#102C3C",
          borderLeft: "1px solid #28505C",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          overflowY: "auto",
        }}
      >
        <div>
          <div style={{ color: "#78959D", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Selected District
          </div>
          <h2 style={{ margin: "4px 0 2px", fontSize: "20px", fontWeight: 600, color: "#EAF4F3" }}>
            {selectedFeature?.properties?.district_name || selectedId.toUpperCase()}
          </h2>
          <span style={{ color: "#54D6BD", fontSize: "12px" }}>
            {selectedFeature?.properties?.region || "Maharashtra"} · {selectedFeature?.properties?.district_code || "MH-020"}
          </span>
        </div>

        {/* Key Metrics Table */}
        <div style={{ borderTop: "1px solid #28505C", paddingTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#A5BEC3", marginBottom: "8px" }}>
            Observed Indicator
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #193B4A" }}>
            <span style={{ color: "#78959D", fontSize: "12px" }}>Layer</span>
            <span style={{ color: "#EAF4F3", fontSize: "12px", fontWeight: 500 }}>{activeLayer.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #193B4A" }}>
            <span style={{ color: "#78959D", fontSize: "12px" }}>Measured Value</span>
            <span className="num" style={{ color: selectedFeature?.properties?.measured_value !== null ? "#54D6BD" : "#78959D", fontSize: "13px", fontWeight: 600 }}>
              {selectedFeature?.properties?.measured_value !== null && selectedFeature?.properties?.measured_value !== undefined
                ? `${selectedFeature.properties.measured_value} ${activeLayer.unit}`
                : "Unavailable"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #193B4A" }}>
            <span style={{ color: "#78959D", fontSize: "12px" }}>Freshness</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "3px",
                background: selectedFeature?.properties?.data_freshness === "RECENT" ? "#54D6BD" : "#193B4A",
                color: selectedFeature?.properties?.data_freshness === "RECENT" ? "#071D2C" : "#A5BEC3",
                fontWeight: 600,
              }}
            >
              {selectedFeature?.properties?.data_freshness || "HISTORICAL"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #193B4A" }}>
            <span style={{ color: "#78959D", fontSize: "12px" }}>Source</span>
            <span style={{ color: "#A5BEC3", fontSize: "12px" }}>{activeLayer.source}</span>
          </div>
        </div>

        {/* Link to District Details */}
        <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #28505C" }}>
          <Link
            href={`/districts/${selectedId}`}
            style={{
              display: "block",
              textAlign: "center",
              background: "#54D6BD",
              color: "#071D2C",
              padding: "8px 14px",
              borderRadius: "4px",
              fontWeight: 600,
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            Open Full District Profile →
          </Link>
        </div>
      </aside>
    </div>
  );
}

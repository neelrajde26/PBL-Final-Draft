"use client";

import type { FeatureCollection, MultiPolygon } from "geojson";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Map, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";

setWorkerUrl("/maplibre-gl-worker.mjs");
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

/**
 * Builds a MapLibre fill-color expression based on layer palette and measured_value.
 * Maps null/undefined measured_value to a distinct dark muted no-data color (#141c26).
 */
function buildFillColorExpression(layer: MapLayer): unknown[] {
  const palette = layer.palette && layer.palette.length > 0 ? layer.palette : ["#102C3C", "#54d6bd"];
  const min = typeof layer.min === "number" ? layer.min : 0;
  const max = typeof layer.max === "number" ? layer.max : 100;
  const range = max > min ? max - min : 1;
  const numSteps = palette.length;

  if (numSteps === 1) {
    return [
      "case",
      ["==", ["get", "measured_value"], null],
      "#141c26",
      palette[0],
    ];
  }

  const stepArgs: unknown[] = [
    "step",
    ["to-number", ["get", "measured_value"], min],
    palette[0],
  ];

  for (let i = 1; i < numSteps; i++) {
    const threshold = Number((min + (i / numSteps) * range).toFixed(2));
    stepArgs.push(threshold);
    stepArgs.push(palette[i]);
  }

  return [
    "case",
    ["==", ["get", "measured_value"], null],
    "#141c26",
    stepArgs,
  ];
}

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
  const [showRaster, setShowRaster] = useState(false);

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
        const [boundResult, indResult] = await Promise.allSettled([
          getDistrictBoundaries(),
          getDistrictIndicators(activeLayerId),
        ]);
        if (!active) return;

        if (boundResult.status === "fulfilled") {
          setBoundaries(boundResult.value);
        } else {
          setError(
            boundResult.reason instanceof Error
              ? boundResult.reason.message
              : "Failed to load Maharashtra boundaries.",
          );
        }

        if (indResult.status === "fulfilled") {
          setIndicatorData(indResult.value);
        } else {
          // Gracefully continue in boundary-only geometry mode
          setIndicatorData(null);
        }
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

  const hasObservations = useMemo(() => {
    if (!indicatorData?.features?.length) return false;
    return indicatorData.features.some((f) => f.properties.measured_value !== null && f.properties.measured_value !== undefined);
  }, [indicatorData]);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !boundaries) return;

    const map = new Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          // Sentinel-2 cloudless 2016 by EOX, CC BY 4.0: a real satellite basemap with no key.
          s2: {
            type: "raster",
            tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
            tileSize: 256,
            maxzoom: 13,
            attribution:
              '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016) · Boundaries: Survey of India',
          },
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#071d2c" } },
          { id: "basemap", type: "raster", source: "s2", paint: { "raster-brightness-max": 0.62, "raster-saturation": -0.25, "raster-contrast": 0.05 } },
        ],
      },
      center: [76.5, 19.1],
      zoom: 5.6,
      minZoom: 4.8,
      maxZoom: 9.5,
      attributionControl: { compact: true },
    });
    if (process.env.NODE_ENV !== "production") (window as unknown as { __mdisMap?: Map }).__mdisMap = map;

    map.on("load", () => {
      const initialGeoData = (indicatorData || boundaries) as unknown as FeatureCollection<MultiPolygon>;
      map.addSource("districts", {
        type: "geojson",
        data: initialGeoData,
      });

      // 1. Fill layer - dynamically styled by observation
      map.addLayer({
        id: "districts-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": buildFillColorExpression(activeLayer) as unknown as string,
          "fill-opacity": [
            "case",
            ["==", ["get", "district_id"], selectedIdRef.current],
            0.92,
            ["==", ["get", "measured_value"], null],
            0.35,
            0.75,
          ],
        },
      });

      // 2. Base boundary outline
      map.addLayer({
        id: "districts-outline",
        type: "line",
        source: "districts",
        paint: {
          "line-color": "#28505c",
          "line-width": 1.2,
          "line-opacity": 0.8,
        },
      });

      // 3. Hover highlight
      map.addLayer({
        id: "districts-highlight",
        type: "line",
        source: "districts",
        filter: ["==", ["get", "district_id"], ""],
        paint: {
          "line-color": "#54d6bd",
          "line-width": 2.0,
        },
      });

      // 4. Selected district outline (Aqua 2.5px)
      map.addLayer({
        id: "districts-selected",
        type: "line",
        source: "districts",
        filter: ["==", ["get", "district_id"], selectedIdRef.current],
        paint: {
          "line-color": "#54d6bd",
          "line-width": 2.5,
          "line-opacity": 1.0,
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
  }, [boundaries]); // eslint-disable-line react-hooks/exhaustive-deps

  // ResizeObserver to ensure MapLibre canvas never renders with 0x0 dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Update GeoJSON source when indicatorData updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateSource = () => {
      const source = map.getSource("districts") as GeoJSONSource | undefined;
      if (source) {
        const data = (indicatorData || boundaries) as unknown as FeatureCollection<MultiPolygon>;
        if (data) {
          source.setData(data);
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once("load", updateSource);
    }
  }, [indicatorData, boundaries]);

  // Update styles on selectedId, filteredDistrictIds, or activeLayer change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("districts-fill")) return;

    const colorExpr = buildFillColorExpression(activeLayer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setPaintProperty("districts-fill", "fill-color", colorExpr as any);

    map.setPaintProperty("districts-fill", "fill-opacity", [
      "case",
      ["==", ["get", "district_id"], selectedId],
      0.92,
      ["!", ["in", ["get", "district_id"], ["literal", Array.from(filteredDistrictIds)]]],
      0.15,
      ["==", ["get", "measured_value"], null],
      0.35,
      0.75,
    ]);

    if (map.getLayer("districts-selected")) {
      map.setFilter("districts-selected", ["==", ["get", "district_id"], selectedId]);
    }
  }, [selectedId, filteredDistrictIds, activeLayer]);

  // Toggle GEE Raster Tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const sourceId = "gee-raster-source";
    const layerId = "gee-raster-layer";

    if (showRaster) {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "raster",
          tiles: [`/api/maps/raster-tile/${activeLayerId}/{z}/{x}/{y}`],
          tileSize: 256,
        });
      }
      if (!map.getLayer(layerId) && map.getSource(sourceId)) {
        map.addLayer(
          {
            id: layerId,
            type: "raster",
            source: sourceId,
            paint: { "raster-opacity": 0.65 },
          },
          "districts-outline",
        );
      }
    } else {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }, [showRaster, activeLayerId]);

  const resetView = () => {
    mapRef.current?.fitBounds(MAHARASHTRA_BOUNDS, { padding: 40, duration: 600 });
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className="gis-wrapper" style={{ position: "relative", width: "100%", height: "100%", display: "flex", background: "#071d2c" }}>
      {/* Map Main Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: "580px" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "580px", background: "#071d2c" }} />

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(7, 10, 14, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#54d6bd",
              fontSize: "15px",
              zIndex: 20,
            }}
          >
            <RefreshCw className="animate-spin" size={18} style={{ marginRight: "8px" }} />
            Synchronizing Maharashtra spatial indicators & satellite boundaries…
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
              background: "#0c1117",
              border: "1px solid #ef4444",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "14px",
              color: "#f87171",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={14} />
            <span>{error}</span>
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
              background: "#0c1117",
              border: "1px solid #28505c",
              borderRadius: "6px",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <Layers size={14} color="#54d6bd" />
            <select
              value={activeLayerId}
              onChange={(e) => setActiveLayerId(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#f1f5f9",
                fontSize: "14px",
                fontWeight: 500,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id} style={{ background: "#0c1117", color: "#f1f5f9" }}>
                  {l.name} ({l.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div
            style={{
              background: "#0c1117",
              border: "1px solid #28505c",
              borderRadius: "6px",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <Filter size={14} color="#a5bec3" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#f1f5f9",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {regions.map((r) => (
                <option key={r} value={r} style={{ background: "#0c1117", color: "#f1f5f9" }}>
                  {r === "All" ? "All Regions" : r}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div
            style={{
              background: "#0c1117",
              border: "1px solid #28505c",
              borderRadius: "6px",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <Search size={14} color="#a5bec3" />
            <input
              type="text"
              placeholder="Search district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#f1f5f9",
                fontSize: "14px",
                outline: "none",
                width: "120px",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: "#a5bec3", cursor: "pointer", padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Raster Overlay Toggle */}
          <button
            type="button"
            onClick={() => setShowRaster(!showRaster)}
            title="Toggle Earth Engine Satellite Raster Tiles (Requires authenticated GEE)"
            style={{
              background: showRaster ? "#0e3542" : "#0c1117",
              border: showRaster ? "1px solid #54d6bd" : "1px solid #28505c",
              borderRadius: "6px",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: showRaster ? "#54d6bd" : "#a5bec3",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            {showRaster ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Raster Tiles</span>
          </button>
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
              background: "#0c1117",
              border: "1px solid #28505c",
              borderRadius: "6px",
              color: "#f1f5f9",
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
              background: "#0c1117",
              border: "1px solid #28505c",
              borderRadius: "6px",
              color: "#f1f5f9",
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
              background: "#0c1117",
              border: "1px solid #28505c",
              borderRadius: "6px",
              color: "#f1f5f9",
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
              background: "#0c1117",
              border: "1px solid #54d6bd",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "#f1f5f9",
              fontSize: "14px",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <strong style={{ display: "block", color: "#54d6bd" }}>
              {String(hoveredProps.district_name ?? hoveredProps.district_id ?? "District")}
            </strong>
            <span style={{ color: "#a5bec3", fontSize: "15px" }}>
              {String(hoveredProps.region ?? "Maharashtra")} · {hoveredProps.measured_value !== null && hoveredProps.measured_value !== undefined ? `${hoveredProps.measured_value} ${activeLayer.unit}` : "No Measured Data"}
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
            background: "#0c1117",
            border: "1px solid #28505c",
            borderRadius: "6px",
            padding: "10px 14px",
            fontSize: "15px",
            maxWidth: "320px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, color: "#f1f5f9" }}>
              {activeLayer.name} ({activeLayer.unit})
            </span>
            <span style={{ fontSize: "15px", color: hasObservations ? "#54d6bd" : "#a5bec3", fontWeight: 500 }}>
              {hasObservations ? "Observed (stored extract)" : "No observations stored"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "2px", height: "8px", borderRadius: "3px", overflow: "hidden", marginBottom: "4px" }}>
            {activeLayer.palette.map((color, idx) => (
              <div key={idx} style={{ flex: 1, background: color }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#a5bec3", fontSize: "15px" }}>
            <span>{activeLayer.min}</span>
            <span>Source: {activeLayer.source}</span>
            <span>{activeLayer.max}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", paddingTop: "4px", borderTop: "1px solid #28505c", color: "#a5bec3", fontSize: "15px" }}>
            <div style={{ width: "10px", height: "10px", background: "#141c26", border: "1px solid #334155", borderRadius: "2px" }} />
            <span>Muted Slate = No observation available</span>
          </div>
        </div>
      </div>

      {/* District Detail Drawer (Right side) */}
      <aside
        style={{
          width: "320px",
          background: "#0c1117",
          borderLeft: "1px solid #28505c",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          overflowY: "auto",
        }}
      >
        <div>
          <div style={{ color: "#a5bec3", fontSize: "15px" }}>
            Selected District
          </div>
          <h2 style={{ margin: "4px 0 2px", fontSize: "20px", fontWeight: 600, color: "#f1f5f9" }}>
            {selectedFeature?.properties?.district_name || selectedId.toUpperCase()}
          </h2>
          <span style={{ color: "#54d6bd", fontSize: "14px" }}>
            {selectedFeature?.properties?.region || "Maharashtra"} · {selectedFeature?.properties?.district_code || "MH-020"}
          </span>
        </div>

        {/* Key Metrics Table */}
        <div style={{ borderTop: "1px solid #28505c", paddingTop: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#a5bec3", marginBottom: "8px" }}>
            Observed Indicator
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #16202c" }}>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>Active Layer</span>
            <span style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: 500 }}>{activeLayer.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #16202c" }}>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>Measured Value</span>
            <span className="num" style={{ color: selectedFeature?.properties?.measured_value !== null ? "#54d6bd" : "#a5bec3", fontSize: "15px", fontWeight: 600 }}>
              {selectedFeature?.properties?.measured_value !== null && selectedFeature?.properties?.measured_value !== undefined
                ? `${selectedFeature.properties.measured_value} ${activeLayer.unit}`
                : "Unavailable (No Data)"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #16202c" }}>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>Observation Date</span>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>
              {selectedFeature?.properties?.observation_date || "N/A"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #16202c" }}>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>Data Freshness</span>
            <span
              style={{
                fontSize: "15px",
                padding: "2px 6px",
                borderRadius: "3px",
                background: selectedFeature?.properties?.data_freshness === "RECENT" ? "#083344" : "#16202c",
                color: selectedFeature?.properties?.data_freshness === "RECENT" ? "#54d6bd" : "#a5bec3",
                fontWeight: 600,
              }}
            >
              {selectedFeature?.properties?.data_freshness || "HISTORICAL"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #16202c" }}>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>Sensor Source</span>
            <span style={{ color: "#a5bec3", fontSize: "14px" }}>{activeLayer.source}</span>
          </div>
        </div>

        {/* Link to District Details */}
        <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #28505c" }}>
          <Link
            href={`/districts/${selectedId}`}
            style={{
              display: "block",
              textAlign: "center",
              background: "#54d6bd",
              color: "#071d2c",
              padding: "10px 14px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "15px",
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

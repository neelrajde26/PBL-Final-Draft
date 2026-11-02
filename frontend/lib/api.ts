import { z } from "zod";

const DEFAULT_DEVELOPMENT_API = "http://127.0.0.1:8000/api";
const DEFAULT_TIMEOUT_MS = 8_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly path: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function getApiBase(): string {
  const configured = typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    : process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    // Graceful fallback to default development API or relative path
    return DEFAULT_DEVELOPMENT_API;
  }
  return DEFAULT_DEVELOPMENT_API;
}

const centroidSchema = z.object({ longitude: z.number(), latitude: z.number() });
const districtSchema = z.object({
  id: z.string(), code: z.string(), name: z.string(), region: z.string(),
  legacy_names: z.array(z.string()), is_priority: z.boolean(),
  boundary_available: z.boolean(), boundary_version: z.string().nullable(),
  centroid: centroidSchema.nullable(),
});
const districtResponseSchema = z.object({
  count: z.number().int().nonnegative(), items: z.array(districtSchema),
});
const boundaryPropertiesSchema = z.object({
  district_id: z.string(), district_code: z.string(), district_name: z.string(),
  region: z.string(), boundary_version: z.string(), source_name: z.string(),
  source_url: z.string().nullable(), centroid_lon: z.number(), centroid_lat: z.number(),
  checksum_sha256: z.string(), stored_at: z.string(),
});
const boundaryFeatureSchema = z.object({
  type: z.literal("Feature"), id: z.string(),
  geometry: z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.unknown()) }),
  properties: boundaryPropertiesSchema,
});
const boundaryCollectionSchema = z.object({
  type: z.literal("FeatureCollection"), count: z.number().int().nonnegative(),
  features: z.array(boundaryFeatureSchema),
});

const observationSchema = z.object({
  variable_key: z.string(), observation_time: z.string(), period_start: z.string(),
  period_end: z.string(), mean_value: z.number().nullable(), median_value: z.number().nullable(),
  minimum_value: z.number().nullable(), maximum_value: z.number().nullable(),
  valid_pixel_count: z.number().int().nullable(), total_pixel_count: z.number().int().nullable(),
  coverage_percentage: z.number().nullable(), unit: z.string(), quality_status: z.string(),
  processing_metadata: z.record(z.string(), z.unknown()).nullable(), ingested_at: z.string(),
  is_demo: z.boolean(), source_key: z.string(), source_name: z.string(), product_id: z.string(),
  native_temporal_resolution: z.string(), native_spatial_resolution_m: z.number().int().nullable(),
  boundary_version: z.string(),
});
const observationResponseSchema = z.object({
  district_id: z.string(), count: z.number().int().nonnegative(), items: z.array(observationSchema),
});

const geeHealthSchema = z.object({
  status: z.string(), configured: z.boolean(), available: z.boolean(),
  project_id: z.string().nullable(), auth_method: z.string().nullable(), checked_at: z.string(),
  message: z.string(),
});
const collectionSchema = z.object({
  key: z.string(), collection_id: z.string(), title: z.string(), temporal_resolution: z.string(),
  native_scale_m: z.number().nullable(), start_date: z.string().nullable(),
  bands: z.array(z.object({
    source_band: z.string(), output_band: z.string(), unit: z.string(), scale: z.number(),
    offset: z.number(), aggregation: z.string(),
  })),
  nominal_period_value: z.number(), nominal_period_unit: z.string(), quality_band: z.string().nullable(),
  notes: z.string(),
});
const collectionResponseSchema = z.object({
  count: z.number().int().nonnegative(), items: z.array(collectionSchema),
});
const readinessSchema = z.object({
  status: z.string(),
  database: z.object({ configured: z.boolean(), available: z.boolean(), message: z.string() }),
  gee: geeHealthSchema,
});

export const mapLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  unit: z.string(),
  source: z.string(),
  min: z.number(),
  max: z.number(),
  palette: z.array(z.string()),
});
export const mapLayersResponseSchema = z.object({
  count: z.number(),
  items: z.array(mapLayerSchema),
});

export const indicatorFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: z.unknown().nullable(),
  properties: z.object({
    district_id: z.string(),
    district_code: z.string(),
    district_name: z.string(),
    region: z.string(),
    indicator: z.string(),
    measured_value: z.number().nullable(),
    unit: z.string(),
    observation_date: z.string().nullable(),
    source: z.string(),
    quality: z.string(),
    coverage_percentage: z.number().nullable(),
    data_freshness: z.string(),
    boundary_version: z.string().nullable(),
    centroid: z.object({ longitude: z.number(), latitude: z.number() }).nullable(),
  }),
});
export const indicatorCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  indicator: z.string(),
  count: z.number(),
  features: z.array(indicatorFeatureSchema),
});

export const alertSchema = z.object({
  id: z.string(),
  district_id: z.string(),
  district_name: z.string(),
  warning_level: z.string(),
  trigger_reason: z.string(),
  observation_date: z.string(),
  prediction_horizon: z.string(),
  environmental_drivers: z.array(z.string()),
  advisory: z.object({ en: z.string(), mr: z.string(), hi: z.string() }).optional(),
  advisory_localized: z.string().optional(),
  status: z.string(),
  created_at: z.string(),
});
export const alertsResponseSchema = z.object({
  count: z.number(),
  items: z.array(alertSchema),
});

export const farmerReportSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  district_id: z.string(),
  taluka: z.string().nullable(),
  village: z.string().nullable(),
  crop: z.string(),
  concern: z.string(),
  observation_date: z.string(),
  description: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  status: z.string(),
  verification_notes: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});
export const farmerReportsResponseSchema = z.object({
  count: z.number(),
  items: z.array(farmerReportSchema),
});

export const modelSchema = z.object({
  id: z.string(),
  model_key: z.string(),
  version: z.string(),
  drought_domain: z.string(),
  algorithm: z.string(),
  forecast_horizon: z.string(),
  target_definition: z.string(),
  target_is_proxy: z.boolean(),
  training_period_start: z.string(),
  training_period_end: z.string(),
  metrics: z.record(z.string(), z.number()),
  baseline_metrics: z.record(z.string(), z.number()),
  feature_schema: z.array(z.string()),
  status: z.string(),
  created_at: z.string(),
});
export const modelsResponseSchema = z.object({
  count: z.number(),
  items: z.array(modelSchema),
});

export type District = z.infer<typeof districtSchema>;
export type DistrictResponse = z.infer<typeof districtResponseSchema>;
export type DistrictBoundaryCollection = z.infer<typeof boundaryCollectionSchema>;
export type DistrictObservation = z.infer<typeof observationSchema>;
export type DistrictObservationResponse = z.infer<typeof observationResponseSchema>;
export type GeeHealth = z.infer<typeof geeHealthSchema>;
export type GeeCollectionResponse = z.infer<typeof collectionResponseSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type MapLayer = z.infer<typeof mapLayerSchema>;
export type IndicatorCollection = z.infer<typeof indicatorCollectionSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type FarmerReport = z.infer<typeof farmerReportSchema>;
export type ModelInfo = z.infer<typeof modelSchema>;

async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("request-timeout")), timeoutMs);
  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      throw new ApiRequestError(`MDIS API returned ${response.status}`, path, response.status);
    }
    try {
      return schema.parse(await response.json());
    } catch (reason) {
      if (reason instanceof z.ZodError) {
        throw new ApiRequestError("MDIS API returned an invalid response schema", path);
      }
      throw reason;
    }
  } catch (reason) {
    if (reason instanceof ApiRequestError) throw reason;
    if (controller.signal.aborted && !signal?.aborted) {
      throw new ApiRequestError(`MDIS API timed out after ${timeoutMs} ms`, path);
    }
    if (signal?.aborted) throw reason;
    throw new ApiRequestError("MDIS API is unreachable", path);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function apiPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal,
    credentials: "include",
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new ApiRequestError(errText || `API error ${response.status}`, path, response.status);
  }
  return schema.parse(await response.json());
}

export function getDistricts(signal?: AbortSignal): Promise<DistrictResponse> {
  return apiGet("/districts", districtResponseSchema, signal);
}

export function getDistrictBoundaries(signal?: AbortSignal): Promise<DistrictBoundaryCollection> {
  return apiGet("/districts/boundaries", boundaryCollectionSchema, signal);
}

export function getDistrictRainfall(
  districtId: string,
  signal?: AbortSignal,
): Promise<DistrictObservationResponse> {
  const query = new URLSearchParams({
    variable: "rainfall", start: "2024-06-01T00:00:00Z", end: "2024-06-04T00:00:00Z",
  });
  return apiGet(
    `/satellite/district/${encodeURIComponent(districtId)}?${query.toString()}`,
    observationResponseSchema,
    signal,
  );
}

export function getBeedRainfall(signal?: AbortSignal): Promise<DistrictObservationResponse> {
  return getDistrictRainfall("beed", signal);
}

export function getGeeHealth(signal?: AbortSignal): Promise<GeeHealth> {
  return apiGet("/gee/health?verify_remote=false", geeHealthSchema, signal);
}

export function getGeeCollections(signal?: AbortSignal): Promise<GeeCollectionResponse> {
  return apiGet("/gee/collections", collectionResponseSchema, signal);
}

export function getReadiness(signal?: AbortSignal): Promise<Readiness> {
  return apiGet("/ready", readinessSchema, signal, 5_000);
}

export function getMapLayers(signal?: AbortSignal): Promise<{ count: number; items: MapLayer[] }> {
  return apiGet("/maps/layers", mapLayersResponseSchema, signal);
}

export function getDistrictIndicators(
  indicator = "rainfall",
  region?: string,
  districtId?: string,
  signal?: AbortSignal,
): Promise<IndicatorCollection> {
  const params = new URLSearchParams({ indicator });
  if (region) params.set("region", region);
  if (districtId) params.set("district_id", districtId);
  return apiGet(`/maps/district-indicators?${params.toString()}`, indicatorCollectionSchema, signal);
}

export function getAlerts(
  districtId?: string,
  warningLevel?: string,
  language = "en",
  signal?: AbortSignal,
): Promise<{ count: number; items: Alert[] }> {
  const params = new URLSearchParams({ language });
  if (districtId) params.set("district_id", districtId);
  if (warningLevel) params.set("warning_level", warningLevel);
  return apiGet(`/alerts?${params.toString()}`, alertsResponseSchema, signal);
}

export function getFarmerReports(
  districtId?: string,
  status?: string,
  signal?: AbortSignal,
): Promise<{ count: number; items: FarmerReport[] }> {
  const params = new URLSearchParams();
  if (districtId) params.set("district_id", districtId);
  if (status) params.set("status", status);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiGet(`/farmer/reports${q}`, farmerReportsResponseSchema, signal);
}

export function submitFarmerReport(
  data: {
    district_id: string;
    concern: string;
    crop?: string;
    taluka?: string;
    village?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
  },
  signal?: AbortSignal,
): Promise<{ status: string; message: string; report: FarmerReport }> {
  return apiPost(
    "/farmer/reports",
    data,
    z.object({ status: z.string(), message: z.string(), report: farmerReportSchema }),
    signal,
  );
}

export function getModels(
  domain?: string,
  signal?: AbortSignal,
): Promise<{ count: number; items: ModelInfo[] }> {
  const q = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  return apiGet(`/models${q}`, modelsResponseSchema, signal);
}

export function getFarmerAdvisory(
  districtId = "beed",
  language = "mr",
  signal?: AbortSignal,
): Promise<{
  district_id: string;
  district_name: string;
  region: string;
  warning_level: string;
  language: string;
  advisory_text: string;
  drivers: string[];
}> {
  return apiGet(
    `/farmer/advisory?district_id=${encodeURIComponent(districtId)}&language=${encodeURIComponent(language)}`,
    z.object({
      district_id: z.string(),
      district_name: z.string(),
      region: z.string(),
      warning_level: z.string(),
      language: z.string(),
      advisory_text: z.string(),
      drivers: z.array(z.string()),
    }),
    signal,
  );
}


export const farmerPredictionResponseSchema = z.object({
  district_id: z.string(),
  district_name: z.string(),
  region: z.string(),
  crop: z.string(),
  growth_stage: z.string().nullable().optional(),
  risk_level: z.string(),
  probability: z.number(),
  horizon: z.string(),
  severity_label_mr: z.string(),
  severity_label_en: z.string(),
  drivers_mr: z.array(z.string()),
  drivers_en: z.array(z.string()),
  advisory_mr: z.string(),
  advisory_en: z.string(),
  is_scenario: z.boolean(),
  confidence: z.string(),
  model_version: z.string(),
});

export type FarmerPredictionResult = z.infer<typeof farmerPredictionResponseSchema>;

export function getFarmerPrediction(
  params: {
    district_id: string;
    crop: string;
    growth_stage?: string;
    sowing_date?: string;
    irrigation_type?: string;
    soil_condition?: string;
    recent_rainfall?: string;
    crop_stress?: string;
    horizon?: string;
  },
  signal?: AbortSignal,
): Promise<FarmerPredictionResult> {
  return apiPost("/farmer/predict", params, farmerPredictionResponseSchema, signal);
}

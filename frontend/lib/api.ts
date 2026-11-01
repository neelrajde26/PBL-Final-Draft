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

function getApiBase(): string {
  const configured = typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    : process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new ApiRequestError(
      "API base URL is not configured for this production runtime",
      "configuration",
    );
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

export type District = z.infer<typeof districtSchema>;
export type DistrictResponse = z.infer<typeof districtResponseSchema>;
export type DistrictBoundaryCollection = z.infer<typeof boundaryCollectionSchema>;
export type DistrictObservation = z.infer<typeof observationSchema>;
export type DistrictObservationResponse = z.infer<typeof observationResponseSchema>;
export type GeeHealth = z.infer<typeof geeHealthSchema>;
export type GeeCollectionResponse = z.infer<typeof collectionResponseSchema>;
export type Readiness = z.infer<typeof readinessSchema>;

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

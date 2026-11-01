BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE districts (
    id text PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    region text NOT NULL,
    legacy_names text[] NOT NULL DEFAULT '{}',
    official_lgd_code text,
    is_priority boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE district_boundaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id text NOT NULL REFERENCES districts(id),
    boundary_version text NOT NULL,
    source_name text NOT NULL,
    source_url text,
    source_published_at date,
    valid_from date,
    valid_to date,
    geometry geometry(MultiPolygon, 4326) NOT NULL,
    centroid geometry(Point, 4326) NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    checksum_sha256 text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (district_id, boundary_version)
);
CREATE INDEX district_boundaries_geometry_gix ON district_boundaries USING gist (geometry);
CREATE UNIQUE INDEX district_boundaries_one_active_idx
    ON district_boundaries (district_id) WHERE is_active;

CREATE TABLE data_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    name text NOT NULL,
    provider text NOT NULL,
    product_id text NOT NULL,
    source_url text,
    native_temporal_resolution text NOT NULL,
    native_spatial_resolution_m integer,
    available_from date,
    unit text,
    license text,
    metadata jsonb NOT NULL DEFAULT '{}',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE environmental_observations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    observation_time timestamptz NOT NULL,
    district_id text NOT NULL REFERENCES districts(id),
    data_source_id uuid NOT NULL REFERENCES data_sources(id),
    boundary_id uuid NOT NULL REFERENCES district_boundaries(id),
    variable_key text NOT NULL,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    mean_value double precision,
    median_value double precision,
    minimum_value double precision,
    maximum_value double precision,
    valid_pixel_count bigint,
    total_pixel_count bigint,
    coverage_percentage double precision CHECK (
        coverage_percentage IS NULL OR coverage_percentage BETWEEN 0 AND 100
    ),
    unit text NOT NULL,
    quality_status text NOT NULL DEFAULT 'unreviewed',
    is_demo boolean NOT NULL DEFAULT false,
    processing_metadata jsonb NOT NULL DEFAULT '{}',
    ingested_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, observation_time),
    UNIQUE (district_id, data_source_id, variable_key, observation_time, boundary_id)
);
SELECT create_hypertable(
    'environmental_observations',
    by_range('observation_time'),
    if_not_exists => TRUE
);
CREATE INDEX environmental_observations_lookup_idx
    ON environmental_observations (district_id, variable_key, observation_time DESC);

CREATE TABLE monthly_district_indicators (
    district_id text NOT NULL REFERENCES districts(id),
    month date NOT NULL,
    indicator_key text NOT NULL,
    value double precision,
    unit text NOT NULL,
    source_observation_ids uuid[] NOT NULL DEFAULT '{}',
    quality_status text NOT NULL,
    is_demo boolean NOT NULL DEFAULT false,
    calculation_metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (district_id, month, indicator_key)
);

CREATE TABLE drought_indices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id text NOT NULL REFERENCES districts(id),
    index_key text NOT NULL,
    drought_domain text NOT NULL CHECK (drought_domain IN ('meteorological', 'agricultural', 'hydrological')),
    observation_date date NOT NULL,
    accumulation_months smallint,
    value double precision,
    category text,
    baseline_start date,
    baseline_end date,
    baseline_sample_count integer,
    method_version text NOT NULL,
    quality_status text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (district_id, index_key, observation_date, method_version)
);
CREATE INDEX drought_indices_lookup_idx
    ON drought_indices (district_id, index_key, observation_date DESC);

CREATE TABLE drought_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id text NOT NULL REFERENCES districts(id),
    drought_domain text NOT NULL,
    onset_date date NOT NULL,
    recovery_date date,
    peak_date date,
    duration_days integer,
    intensity double precision,
    severity text,
    method_version text NOT NULL,
    evidence jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE model_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_key text NOT NULL,
    version text NOT NULL,
    drought_domain text NOT NULL,
    algorithm text NOT NULL,
    forecast_horizon text NOT NULL,
    target_definition text NOT NULL,
    target_is_proxy boolean NOT NULL,
    training_period_start date NOT NULL,
    training_period_end date NOT NULL,
    training_dataset_version text NOT NULL,
    feature_schema jsonb NOT NULL,
    artifact_uri text,
    artifact_sha256 text,
    status text NOT NULL DEFAULT 'candidate',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (model_key, version)
);

CREATE TABLE model_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id uuid NOT NULL REFERENCES model_registry(id),
    evaluation_kind text NOT NULL,
    split_start date,
    split_end date,
    spatial_holdout text[],
    metrics jsonb NOT NULL,
    baseline_metrics jsonb NOT NULL DEFAULT '{}',
    calibration_metadata jsonb NOT NULL DEFAULT '{}',
    passed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prediction_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id text NOT NULL REFERENCES districts(id),
    model_id uuid NOT NULL REFERENCES model_registry(id),
    prediction_time timestamptz NOT NULL,
    target_start date NOT NULL,
    target_end date NOT NULL,
    risk_level text NOT NULL,
    predicted_value double precision,
    probability double precision CHECK (probability IS NULL OR probability BETWEEN 0 AND 1),
    lower_interval double precision,
    upper_interval double precision,
    feature_snapshot jsonb NOT NULL,
    explanation jsonb,
    source_quality text NOT NULL,
    is_demo boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prediction_results_lookup_idx
    ON prediction_results (district_id, target_start DESC);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'researcher', 'farmer')) DEFAULT 'farmer',
    full_name text NOT NULL,
    district_id text REFERENCES districts(id),
    taluka text,
    village text,
    preferred_language text NOT NULL DEFAULT 'en',
    is_active boolean NOT NULL DEFAULT true,
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE farmer_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    district_id text NOT NULL REFERENCES districts(id),
    taluka text,
    village text,
    crop text,
    concern text NOT NULL,
    observation_date date NOT NULL,
    description text CHECK (char_length(description) <= 2000),
    location geometry(Point, 4326),
    status text NOT NULL DEFAULT 'submitted',
    verification_notes text,
    reviewed_by uuid REFERENCES users(id),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farmer_reports_location_gix ON farmer_reports USING gist (location);

CREATE TABLE alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id text NOT NULL REFERENCES districts(id),
    warning_level text NOT NULL,
    trigger_reason text NOT NULL,
    observation_date date NOT NULL,
    prediction_start date,
    prediction_end date,
    environmental_drivers jsonb NOT NULL DEFAULT '[]',
    source_quality text NOT NULL,
    model_id uuid REFERENCES model_registry(id),
    recommended_follow_up text,
    status text NOT NULL DEFAULT 'draft',
    published_by uuid REFERENCES users(id),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid REFERENCES data_sources(id),
    collection_key text NOT NULL,
    status text NOT NULL,
    period_start timestamptz,
    period_end timestamptz,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    district_count integer NOT NULL DEFAULT 0,
    observation_count integer NOT NULL DEFAULT 0,
    retry_count integer NOT NULL DEFAULT 0,
    last_successful_acquisition timestamptz,
    error_type text,
    error_message text,
    metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX ingestion_logs_collection_idx ON ingestion_logs (collection_key, started_at DESC);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    request_id text,
    ip_hash text,
    details jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;


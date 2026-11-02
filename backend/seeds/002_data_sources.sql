INSERT INTO data_sources (
    key, name, provider, product_id, source_url,
    native_temporal_resolution, native_spatial_resolution_m,
    available_from, unit, metadata
) VALUES
(
    'chirps_daily', 'CHIRPS Daily v2 Final', 'UCSB Climate Hazards Center',
    'UCSB-CHG/CHIRPS/DAILY',
    'https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY',
    'daily', 5566, '1981-01-01', 'mm/day',
    '{"operational_note":"The Earth Engine asset is CHIRPS v2 Final, not CHIRPS v3."}'
),
(
    'modis_vi', 'MOD13Q1.061 Terra Vegetation Indices', 'NASA LP DAAC / USGS',
    'MODIS/061/MOD13Q1',
    'https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1',
    '16-day composite', 250, '2000-02-18', 'scaled index', '{}'
),
(
    'modis_lst', 'MOD11A2.061 Terra LST', 'NASA LP DAAC / USGS',
    'MODIS/061/MOD11A2',
    'https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD11A2',
    '8-day composite', 1000, '2000-02-18', 'degC after scaling', '{}'
),
(
    'modis_et', 'MOD16A2.061 Terra ET', 'NASA LP DAAC / USGS',
    'MODIS/061/MOD16A2',
    'https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD16A2',
    '8-day composite', 500, '2021-01-01', 'kg/m2/composite',
    '{"operational_note":"Near-real-time/current product; use the gap-filled product for historical processing."}'
),
(
    'modis_et_gap_filled', 'MOD16A2GF.061 Terra ET Gap-Filled', 'NASA LP DAAC / USGS',
    'MODIS/061/MOD16A2GF',
    'https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD16A2GF',
    '8-day composite', 500, '2000-01-01', 'kg/m2/composite',
    '{"operational_note":"Year-end gap-filled product; availability lags the current year."}'
),
(
    'gldas_noah', 'GLDAS-2.1 Noah 0.25 degree', 'NASA GES DISC',
    'NASA/GLDAS/V021/NOAH/G025/T3H',
    'https://developers.google.com/earth-engine/datasets/catalog/NASA_GLDAS_V021_NOAH_G025_T3H',
    '3-hourly', 27830, '2000-01-01', NULL, '{}'
),
(
    'era5_land_daily', 'ERA5-Land Daily Aggregated', 'ECMWF / Copernicus CDS / Google',
    'ECMWF/ERA5_LAND/DAILY_AGGR',
    'https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR',
    'daily', 11132, '1950-01-02', NULL,
    '{"quality_note":"Flow bands can contain small negative packing artifacts and require QC."}'
),
(
    'smap_l3', 'SMAP L3 Enhanced Radiometer Soil Moisture v006', 'NASA NSIDC / Google',
    'NASA/SMAP/SPL3SMP_E/006',
    'https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL3SMP_E_006',
    'daily composite', 9000, '2023-12-04', 'm3/m3',
    '{"sampling_note":"Mission retrievals typically revisit a location every 2-3 days."}'
),
(
    'sentinel2_sr', 'Sentinel-2 L2A Surface Reflectance Harmonized', 'ESA / Copernicus',
    'COPERNICUS/S2_SR_HARMONIZED',
    'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED',
    '5-day revisit', 10, '2017-03-28', 'reflectance',
    '{"quality_note":"Use SCL/cloud-probability logic; QA60 availability changed over time."}'
),
(
    'sentinel1_grd', 'Sentinel-1 C-band SAR GRD', 'ESA / Copernicus',
    'COPERNICUS/S1_GRD',
    'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD',
    '6-day revisit', 10, '2014-10-03', 'dB',
    '{"limitation":"Backscatter is a land-condition proxy, not a direct soil-moisture measurement."}'
),
(
    'grace_mascon_cri', 'JPL GRACE/GRACE-FO Mascon CRI RL06.3Mv04', 'NASA JPL',
    'NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI',
    'https://developers.google.com/earth-engine/datasets/catalog/NASA_GRACE_MASS_GRIDS_V04_MASCON_CRI',
    'monthly', 55660, '2002-03-31', 'cm equivalent water thickness',
    '{"limitation":"Underlying estimates are approximately 3-degree mascons. Values are terrestrial water storage anomalies, not district groundwater measurements."}'
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    provider = EXCLUDED.provider,
    product_id = EXCLUDED.product_id,
    source_url = EXCLUDED.source_url,
    native_temporal_resolution = EXCLUDED.native_temporal_resolution,
    native_spatial_resolution_m = EXCLUDED.native_spatial_resolution_m,
    available_from = EXCLUDED.available_from,
    unit = EXCLUDED.unit,
    metadata = EXCLUDED.metadata,
    updated_at = now();


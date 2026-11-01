from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_collections import BandSpec, CollectionSpec, get_collection_spec


@dataclass(frozen=True, slots=True)
class CompositeResult:
    spec: CollectionSpec
    image: Any
    collection: Any
    image_count: Any
    first_acquisition_ms: Any
    last_acquisition_ms: Any


class GeeProcessor:
    def __init__(self, client: EarthEngineClient) -> None:
        self.client = client

    @staticmethod
    def _scaled_band(image: Any, band: BandSpec) -> Any:
        return (
            image.select(band.source_band)
            .multiply(band.scale)
            .add(band.offset)
            .rename(band.output_band)
        )

    def _mask_and_transform(self, spec: CollectionSpec, image: Any) -> Any:
        key = spec.key

        if key == "modis_vi":
            image = image.updateMask(image.select("SummaryQA").lte(1))
        elif key == "modis_lst":
            day_ok = image.select("QC_Day").bitwiseAnd(3).lte(1)
            night_ok = image.select("QC_Night").bitwiseAnd(3).lte(1)
            image = image.updateMask(day_ok.And(night_ok))
        elif key in {"modis_et", "modis_et_gap_filled"}:
            qc = image.select("ET_QC")
            image = image.updateMask(qc.bitwiseAnd(1).eq(0)).updateMask(
                qc.rightShift(5).bitwiseAnd(7).lte(1)
            )
        elif key == "smap_l3":
            am_ok = image.select("retrieval_qual_flag_am").eq(0)
            pm_ok = image.select("retrieval_qual_flag_pm").eq(0)
            image = image.updateMask(am_ok.And(pm_ok))
        elif key == "sentinel2_sr":
            scl = image.select("SCL")
            valid = (
                scl.neq(0)
                .And(scl.neq(1))
                .And(scl.neq(3))
                .And(scl.neq(7))
                .And(scl.neq(8))
                .And(scl.neq(9))
                .And(scl.neq(10))
                .And(scl.neq(11))
            )
            image = image.updateMask(valid)

        output = None
        for band in spec.bands:
            scaled = self._scaled_band(image, band)
            output = scaled if output is None else output.addBands(scaled)

        if key == "sentinel2_sr":
            blue = output.select("blue")
            green = output.select("green")
            red = output.select("red")
            nir = output.select("nir")
            ndvi = nir.subtract(red).divide(nir.add(red)).rename("ndvi")
            ndwi = green.subtract(nir).divide(green.add(nir)).rename("ndwi")
            evi = (
                nir.subtract(red)
                .multiply(2.5)
                .divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1))
                .rename("evi")
            )
            output = output.addBands([ndvi, evi, ndwi])
        elif key == "sentinel1_grd":
            output = output.addBands(output.select("vv").subtract(output.select("vh")).rename("vv_vh_db"))

        return output.copyProperties(image, image.propertyNames())

    def prepared_collection(
        self,
        collection_key: str,
        start_date: str,
        end_date: str,
        geometry: Any | None = None,
    ) -> tuple[CollectionSpec, Any]:
        spec = get_collection_spec(collection_key)
        collection = self.client.image_collection(spec.collection_id).filterDate(start_date, end_date)
        if geometry is not None:
            collection = collection.filterBounds(geometry)
        if spec.key == "sentinel1_grd":
            ee = self.client.initialize(verify_remote=False)
            collection = (
                collection.filter(ee.Filter.eq("instrumentMode", "IW"))
                .filter(ee.Filter.eq("resolution_meters", 10))
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
            )
        return spec, collection.map(lambda image: self._mask_and_transform(spec, image))

    def composite(
        self,
        collection_key: str,
        start_date: str,
        end_date: str,
        geometry: Any | None = None,
    ) -> CompositeResult:
        ee = self.client.initialize(verify_remote=False)
        spec, collection = self.prepared_collection(
            collection_key,
            start_date,
            end_date,
            geometry,
        )
        output = None
        for band in spec.bands:
            band_collection = collection.select(band.output_band)
            band_image = band_collection.sum() if band.aggregation == "sum" else band_collection.mean()
            band_image = band_image.rename(band.output_band)
            output = band_image if output is None else output.addBands(band_image)

        if spec.key == "sentinel2_sr":
            indices = collection.select(["ndvi", "evi", "ndwi"]).median()
            output = output.addBands(indices)
        elif spec.key == "sentinel1_grd":
            output = output.addBands(collection.select("vv_vh_db").median())

        output = output.set(
            {
                "mdis:collection_key": spec.key,
                "mdis:collection_id": spec.collection_id,
                "mdis:period_start": start_date,
                "mdis:period_end": end_date,
                "mdis:image_count": collection.size(),
            }
        )
        return CompositeResult(
            spec=spec,
            image=output,
            collection=collection,
            image_count=collection.size(),
            first_acquisition_ms=collection.aggregate_min("system:time_start"),
            last_acquisition_ms=collection.aggregate_max("system:time_start"),
        )


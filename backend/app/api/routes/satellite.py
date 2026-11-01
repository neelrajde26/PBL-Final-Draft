from fastapi import APIRouter, HTTPException

from app.services.gee.gee_collections import COLLECTIONS, get_collection_spec


router = APIRouter(prefix="/satellite", tags=["satellite"])


@router.get("/collections")
def list_collections() -> dict[str, object]:
    items = [spec.public_metadata() for spec in COLLECTIONS.values()]
    return {"count": len(items), "items": items}


@router.get("/collections/{collection_key}")
def collection_detail(collection_key: str) -> dict[str, object]:
    try:
        return get_collection_spec(collection_key).public_metadata()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


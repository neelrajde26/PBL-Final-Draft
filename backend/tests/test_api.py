from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_and_district_endpoints() -> None:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    districts = client.get("/api/districts")
    assert districts.status_code == 200
    assert districts.json()["count"] == 36


def test_collection_registry_endpoint() -> None:
    response = client.get("/api/satellite/collections")
    assert response.status_code == 200
    assert response.json()["count"] >= 11


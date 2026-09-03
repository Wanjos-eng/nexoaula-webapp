from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "API is running"}


def test_openapi_documents_health():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/health" in response.json()["paths"]


def test_interactive_docs_available():
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200

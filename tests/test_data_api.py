import io
import zipfile
from backend.models.database import DATA_DIR

def test_export_data(api_client):
    response = api_client.post("/api/data/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    
    # Validate the exported zip contents
    zip_bytes = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        namelist = zf.namelist()
        assert "tuesday.db" in namelist

def test_import_data_missing_db(api_client):
    # Create an invalid zip that misses the DB
    zip_bytes = io.BytesIO()
    with zipfile.ZipFile(zip_bytes, "w") as zf:
        zf.writestr("test.txt", "hello")
        
    zip_bytes.seek(0)
    files = {"file": ("backup.zip", zip_bytes, "application/zip")}
    response = api_client.post("/api/data/import", files=files)
    
    assert response.status_code == 400
    assert "Missing database" in response.json()["detail"]

def test_import_data_zip_slip(api_client):
    zip_bytes = io.BytesIO()
    with zipfile.ZipFile(zip_bytes, "w") as zf:
        # SQLite magic bytes to pass db validation (though it won't get there)
        zf.writestr("tuesday.db", b"SQLite format 3\x00")
        # Malicious path
        zf.writestr("../../../etc/passwd", "malicious payload")
        
    zip_bytes.seek(0)
    files = {"file": ("backup.zip", zip_bytes, "application/zip")}
    response = api_client.post("/api/data/import", files=files)
    
    assert response.status_code == 400
    assert "Invalid path in zip" in response.json()["detail"]

def test_import_data_success(api_client):
    # Get a valid backup from the export endpoint
    export_resp = api_client.post("/api/data/export")
    assert export_resp.status_code == 200
    
    # Import that same valid backup
    zip_bytes = io.BytesIO(export_resp.content)
    files = {"file": ("backup.zip", zip_bytes, "application/zip")}
    response = api_client.post("/api/data/import", files=files)
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"

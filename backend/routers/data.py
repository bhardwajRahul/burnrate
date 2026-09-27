import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import pyzipper

from backend.models.database import DATA_DIR, UPLOADS_DIR, engine, DATABASE_URL
from backend.models.models import Settings

router = APIRouter(tags=["data"])

def cleanup_tmp(path: str):
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass

@router.post("/data/export")
def export_data(background_tasks: BackgroundTasks, password: Optional[str] = Form(None)):
    """Export tuesday.db and uploads directory as a ZIP, optionally AES encrypted."""
    tmp_dir = tempfile.mkdtemp()
    background_tasks.add_task(cleanup_tmp, tmp_dir)
    zip_path = Path(tmp_dir) / "burnrate_backup.zip"
    
    if password:
        zf = pyzipper.AESZipFile(zip_path, 'w', compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES)
        zf.setpassword(password.encode('utf-8'))
    else:
        zf = zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED)
        
    with zf:
        db_file = DATA_DIR / "tuesday.db"
        if db_file.exists():
            zf.write(db_file, "tuesday.db")
            
        if UPLOADS_DIR.exists():
            for root, _, files in os.walk(UPLOADS_DIR):
                for f in files:
                    file_path = Path(root) / f
                    arcname = Path("statements") / file_path.relative_to(UPLOADS_DIR)
                    zf.write(file_path, str(arcname))
                    
    return FileResponse(
        path=zip_path, 
        filename="burnrate_backup.zip", 
        media_type="application/zip"
    )

@router.post("/data/import")
def import_data(file: UploadFile = File(...), password: Optional[str] = Form(None)):
    """Import a ZIP backup containing tuesday.db and optional statements/."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Must be a .zip file")
        
    tmp_dir = tempfile.mkdtemp()
    try:
        upload_path = Path(tmp_dir) / "uploaded.zip"
        with open(upload_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # 1. Validate ZIP before extraction
        with pyzipper.AESZipFile(upload_path, 'r') as zf:
            if password:
                zf.setpassword(password.encode('utf-8'))
            
            namelist = zf.namelist()
            if "tuesday.db" not in namelist and "burnrate.db" not in namelist:
                raise HTTPException(status_code=400, detail="Missing database (tuesday.db) in backup")
                
            for name in namelist:
                if name.endswith("/"):
                    continue
                # Zip Slip Prevention
                if ".." in name or name.startswith("/"):
                    raise HTTPException(status_code=400, detail=f"Invalid path in zip: {name}")
                
            # 2. Extract strictly allowed files
            extract_dir = Path(tmp_dir) / "extracted"
            extract_dir.mkdir()
            
            for name in namelist:
                if name.endswith("/"): continue
                if ".." in name or name.startswith("/"): continue
                
                try:
                    # Strict allowlist
                    if name in ["tuesday.db", "burnrate.db"]:
                        target_path = extract_dir / "tuesday.db"
                        with zf.open(name) as sf, open(target_path, "wb") as df:
                            header = sf.read(16)
                            # Magic Bytes for SQLite
                            if header != b"SQLite format 3\x00":
                                raise HTTPException(status_code=400, detail="Invalid database file format")
                            df.write(header)
                            shutil.copyfileobj(sf, df)
                            
                    elif name.startswith("statements/"):
                        ext = os.path.splitext(name)[1].lower()
                        if ext in [".pdf", ".csv"]:
                            target_path = extract_dir / name
                            target_path.parent.mkdir(parents=True, exist_ok=True)
                            with zf.open(name) as sf, open(target_path, "wb") as df:
                                if ext == ".pdf":
                                    header = sf.read(5)
                                    # Magic Bytes for PDF
                                    if not header.startswith(b"%PDF-"):
                                        continue # Skip invalid pdfs
                                    df.write(header)
                                    shutil.copyfileobj(sf, df)
                                else:
                                    shutil.copyfileobj(sf, df)
                except RuntimeError as e:
                    if 'password' in str(e).lower() or 'bad password' in str(e).lower():
                        raise HTTPException(status_code=400, detail="Invalid or missing password for encrypted backup")
                    raise

        if not (extract_dir / "tuesday.db").exists():
            raise HTTPException(status_code=400, detail="Valid database file not found in archive")
            
        # 3. Backup current state
        backup_dir = DATA_DIR.parent / "data.backup"
        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
        shutil.copytree(DATA_DIR, backup_dir)
        
        # 4. Replace DB and Statements
        # Dispose engine to close active DB connections
        engine.dispose()
        
        db_file = DATA_DIR / "tuesday.db"
        wal_file = DATA_DIR / "tuesday.db-wal"
        shm_file = DATA_DIR / "tuesday.db-shm"
        
        if db_file.exists(): os.remove(db_file)
        if wal_file.exists(): os.remove(wal_file)
        if shm_file.exists(): os.remove(shm_file)
        
        shutil.copy(extract_dir / "tuesday.db", db_file)
        
        extracted_statements = extract_dir / "statements"
        if extracted_statements.exists():
            if UPLOADS_DIR.exists():
                shutil.rmtree(UPLOADS_DIR, ignore_errors=True)
            shutil.copytree(extracted_statements, UPLOADS_DIR)
            
        # 5. Check and clear watch_folder if missing
        tmp_engine = create_engine(DATABASE_URL)
        Session = sessionmaker(bind=tmp_engine)
        with Session() as session:
            settings = session.query(Settings).first()
            if settings and settings.watch_folder:
                if not os.path.exists(settings.watch_folder):
                    settings.watch_folder = None
                    session.commit()
        tmp_engine.dispose()
        
        return {"status": "success", "message": "Data imported successfully"}
    except Exception as e:
        # Re-raise HTTPExceptions
        if isinstance(e, HTTPException):
            raise
        import logging
        logging.getLogger(__name__).exception("Import failed")
        raise HTTPException(status_code=500, detail="Import failed. The backend might need restarting.")
    finally:
        cleanup_tmp(tmp_dir)

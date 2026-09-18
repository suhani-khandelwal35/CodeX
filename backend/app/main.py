from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine

app = FastAPI(title="CodeX API")


@app.get("/")
def root():
    return {"message": "CodeX API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"database": "connected", "result": result.scalar()}
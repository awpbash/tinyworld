"""TinyFish — People OSINT / Digital Footprint Search API."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from models.database import create_tables, SessionLocal
from services.graph_service import rebuild_from_db
from routers import search, connections

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Creating database tables...")
    create_tables()

    logger.info("Rebuilding in-memory graph from DB...")
    db = SessionLocal()
    try:
        rebuild_from_db(db)
    finally:
        db.close()

    logger.info("TinyFish backend ready.")
    yield
    # --- Shutdown ---
    logger.info("TinyFish backend shutting down.")


app = FastAPI(
    title="TinyFish",
    description="People OSINT & Digital Footprint Search",
    version="0.1.0",
    lifespan=lifespan,
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(search.router)
app.include_router(connections.router)


# --- Health check ---
@app.get("/")
def root():
    return {"status": "ok", "app": "TinyFish", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "ok"}

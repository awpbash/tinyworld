import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir / ".env")

# --- API Keys ---
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
TINYFISH_API_KEY: str = os.getenv("TINYFISH_API_KEY", "")

# --- Database ---
DB_PATH: str = str(_backend_dir / "tinyfish.db")
DATABASE_URL: str = f"sqlite:///{DB_PATH}"

# --- Rate limits (seconds between requests per domain) ---
RATE_LIMITS: dict[str, float] = {
    "en.wikipedia.org": 0.2,
    "www.wikidata.org": 0.5,
    "query.wikidata.org": 0.5,
    "www.google.com": 2.0,
}

# --- Cache TTL ---
CACHE_TTL_SECONDS: int = 86400  # 24 hours

# --- LLM ---
LLM_MODEL_FAST: str = "gpt-4o-mini"
LLM_MODEL_COMPLEX: str = "gpt-4o"

# --- TinyFish ---
TINYFISH_TIMEOUT: int = int(os.getenv("TINYFISH_TIMEOUT", "120"))  # seconds

# --- CORS ---
CORS_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

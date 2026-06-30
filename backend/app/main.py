import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .weather import get_weather
from .shelters import get_shelters


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _cors_origin_regex() -> str | None:
    raw = os.getenv("CORS_ORIGIN_REGEX", r"https://hwaseong-coolcare.*\.vercel\.app")
    return raw.strip() or None


app = FastAPI(title="Hwaseong Coolcare API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": "Hwaseong Coolcare API",
        "status": "ok",
        "endpoints": ["/api/health", "/api/weather", "/api/shelters"],
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/weather")
async def weather() -> dict[str, object]:
    return await get_weather()


@app.get("/api/shelters")
async def shelters() -> dict[str, object]:
    return await get_shelters()

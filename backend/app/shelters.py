from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import httpx
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

KST = timezone(timedelta(hours=9))
SHELTER_ENDPOINT = "https://www.safetydata.go.kr/V2/api/DSSP-IF-10942"
DEFAULT_BOUNDS = {
    "startLot": "126.60",
    "endLot": "127.25",
    "startLat": "37.00",
    "endLat": "37.35",
}


def _service_key() -> str:
    key = os.getenv("SHELTER_API_KEY") or os.getenv("PUBLIC_DATA_SERVICE_KEY")
    return unquote(key.strip()) if key else ""


def _endpoint() -> str:
    return os.getenv("SHELTER_API_URL", SHELTER_ENDPOINT).strip() or SHELTER_ENDPOINT


def _fallback(message: str) -> dict[str, object]:
    return {
        "data": [],
        "source": "mockData",
        "ok": False,
        "message": message,
        "updatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
    }


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _pick(item: dict[str, Any], *keys: str) -> str:
    lookup = {str(key).lower(): value for key, value in item.items()}
    for key in keys:
        value = lookup.get(key.lower())
        text = _clean_text(value)
        if text:
            return text
    return ""


def _to_float(value: str) -> float | None:
    try:
        return float(value.replace(",", ""))
    except (TypeError, ValueError):
        return None


def _to_int(value: str) -> int:
    parsed = _to_float(value)
    if parsed is None:
        return 0
    return max(0, int(parsed))


def _items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    header = payload.get("header") if isinstance(payload.get("header"), dict) else {}
    result_code = _clean_text(header.get("resultCode"))
    if result_code and result_code != "00":
        message = _clean_text(header.get("errorMsg")) or _clean_text(header.get("resultMsg"))
        raise ValueError(message or "무더위쉼터 API 응답 오류")

    body = payload.get("body")
    if isinstance(body, list):
        return [item for item in body if isinstance(item, dict)]

    if isinstance(body, dict):
        for key in ("items", "item", "data", "records", "list"):
            value = body.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
            if isinstance(value, dict):
                nested = value.get("item") or value.get("items")
                if isinstance(nested, list):
                    return [item for item in nested if isinstance(item, dict)]
                return [value]

    return []


def _is_hwaseong(item: dict[str, Any]) -> bool:
    keyword = os.getenv("SHELTER_REGION_KEYWORD", "화성").strip()
    if not keyword:
        return True

    haystack = " ".join(
        [
            _pick(item, "RN_DTL_ADRES", "DTL_ADRES", "address", "adres"),
            _pick(item, "RSTR_NM", "name"),
            _pick(item, "RM", "note"),
        ]
    )
    return keyword in haystack


def _normalize_shelter(item: dict[str, Any], index: int) -> dict[str, object] | None:
    lat = _to_float(_pick(item, "LA", "lat", "latitude", "YCORD"))
    lng = _to_float(_pick(item, "LO", "lng", "lon", "longitude", "XCORD"))

    if lat is None or lng is None:
        return None

    name = _pick(item, "RSTR_NM", "name")
    address = _pick(item, "RN_DTL_ADRES", "DTL_ADRES", "address", "adres")
    if not name or not address:
        return None

    note_parts = [
        _pick(item, "FCLTY_TY", "FCLTY_SCLAS"),
        _pick(item, "DTL_POSITION"),
        _pick(item, "RM"),
    ]
    note = " · ".join(part for part in note_parts if part) or "재난안전데이터 무더위쉼터"

    return {
        "id": _pick(item, "RSTR_FCLTY_NO", "id") or f"shelter-api-{index + 1}",
        "name": name,
        "address": address,
        "lat": lat,
        "lng": lng,
        "areaM2": _to_int(_pick(item, "AR", "areaM2")),
        "capacity": _to_int(_pick(item, "USE_PSBL_NMPR", "capacity")),
        "airConditioners": _to_int(_pick(item, "COLR_HOLD_ARCNDTN", "airConditioners")),
        "fans": _to_int(_pick(item, "COLR_HOLD_ELEFN", "fans")),
        "note": note,
    }


def _params(key: str) -> dict[str, str]:
    params = {
        "serviceKey": key,
        "pageNo": os.getenv("SHELTER_PAGE_NO", "1"),
        "numOfRows": os.getenv("SHELTER_NUM_OF_ROWS", "1000"),
        "returnType": "json",
        **DEFAULT_BOUNDS,
    }

    env_aliases = {
        "startLot": ("SHELTER_START_LOT", "SHELTER_STARTLOT"),
        "endLot": ("SHELTER_END_LOT", "SHELTER_ENDLOT"),
        "startLat": ("SHELTER_START_LAT", "SHELTER_STARTLAT"),
        "endLat": ("SHELTER_END_LAT", "SHELTER_ENDLAT"),
    }
    for name, aliases in env_aliases.items():
        for env_name in aliases:
            value = os.getenv(env_name)
            if value:
                params[name] = value.strip()
                break

    return params


async def get_shelters() -> dict[str, object]:
    key = _service_key()
    if not key:
        return _fallback("무더위쉼터 API 키가 없어 mockData를 사용합니다.")

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(_endpoint(), params=_params(key))
            response.raise_for_status()
            payload = response.json()

        shelters = [
            normalized
            for index, item in enumerate(_items(payload))
            if _is_hwaseong(item)
            for normalized in [_normalize_shelter(item, index)]
            if normalized is not None
        ]

        if not shelters:
            return _fallback("무더위쉼터 API 응답에 화성시 좌표 데이터가 없어 mockData를 사용합니다.")

        return {
            "data": shelters,
            "source": "safetydata",
            "ok": True,
            "message": "재난안전데이터 무더위쉼터 API 데이터를 사용합니다.",
            "updatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
        }
    except httpx.HTTPStatusError as error:
        return _fallback(f"무더위쉼터 API 응답 오류 HTTP {error.response.status_code}")
    except httpx.RequestError:
        return _fallback("무더위쉼터 API 연결이 불안정해 mockData를 사용합니다.")
    except Exception as error:
        return _fallback(f"무더위쉼터 API 처리 실패: {type(error).__name__}")

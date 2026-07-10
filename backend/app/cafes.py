from __future__ import annotations

import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

KST = timezone(timedelta(hours=9))
KAKAO_CATEGORY_ENDPOINT = "https://dapi.kakao.com/v2/local/search/category.json"
CAFE_CATEGORY_CODE = "CE7"


def _rest_api_key() -> str:
    return (
        os.getenv("KAKAO_REST_API_KEY")
        or os.getenv("KAKAO_LOCAL_REST_API_KEY")
        or os.getenv("KAKAO_MAP_REST_API_KEY")
        or ""
    ).strip()


def _fallback(status: str, message: str) -> dict[str, object]:
    return {
        "data": [],
        "source": "kakao-local",
        "ok": False,
        "status": status,
        "message": message,
        "updatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
    }


def _kakao_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return ""

    if not isinstance(payload, dict):
        return ""

    parts: list[str] = []
    for key in ("code", "msg", "error", "error_description"):
        value = payload.get(key)
        if value:
            parts.append(f"{key}: {value}")

    return " / ".join(parts)


def _to_float(value: Any) -> float | None:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _distance_km(origin_lat: float, origin_lng: float, lat: float, lng: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat - origin_lat)
    d_lng = math.radians(lng - origin_lng)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(origin_lat)) * math.cos(math.radians(lat)) * math.sin(d_lng / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _normalize_place(item: dict[str, Any], origin_lat: float, origin_lng: float) -> dict[str, object] | None:
    lat = _to_float(item.get("y"))
    lng = _to_float(item.get("x"))
    name = str(item.get("place_name") or "").strip()

    if lat is None or lng is None or not name:
        return None

    distance_m = _to_float(item.get("distance"))
    distance_km = distance_m / 1000 if distance_m is not None else _distance_km(origin_lat, origin_lng, lat, lng)

    return {
        "id": str(item.get("id") or f"{name}-{lat}-{lng}"),
        "name": name,
        "address": str(item.get("address_name") or "").strip(),
        "roadAddress": str(item.get("road_address_name") or "").strip(),
        "lat": lat,
        "lng": lng,
        "phone": str(item.get("phone") or "").strip(),
        "placeUrl": str(item.get("place_url") or "").strip(),
        "distanceKm": round(distance_km, 3),
    }


def _unique_places(places: list[dict[str, object]]) -> list[dict[str, object]]:
    seen: set[str] = set()
    unique: list[dict[str, object]] = []

    for place in places:
        key = str(place.get("id") or "") or f"{place.get('name')}-{place.get('lat')}-{place.get('lng')}"
        if key in seen:
            continue

        seen.add(key)
        unique.append(place)

    return sorted(unique, key=lambda place: float(place.get("distanceKm") or 0))


async def get_cafes(lat: float, lng: float, radius: int = 5000) -> dict[str, object]:
    key = _rest_api_key()
    if not key:
        return _fallback("no-key", "백엔드 환경변수 KAKAO_REST_API_KEY가 설정되어 있지 않습니다.")

    safe_radius = min(max(int(radius), 0), 20000)
    params = {
        "category_group_code": CAFE_CATEGORY_CODE,
        "x": str(lng),
        "y": str(lat),
        "radius": str(safe_radius),
        "sort": "distance",
        "page": "1",
        "size": "15",
    }
    headers = {
        "Accept": "application/json",
        "Authorization": f"KakaoAK {key}",
    }

    try:
        timeout = httpx.Timeout(8.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            response = await client.get(KAKAO_CATEGORY_ENDPOINT, params=params)
            response.raise_for_status()
            payload = response.json()

        documents = payload.get("documents")
        if not isinstance(documents, list):
            documents = []

        cafes = _unique_places(
            [
                normalized
                for item in documents
                if isinstance(item, dict)
                for normalized in [_normalize_place(item, lat, lng)]
                if normalized is not None
            ]
        )

        if not cafes:
            return _fallback("zero-result", "카카오 로컬 API는 연결됐지만 선택 위치 주변 카페 결과가 없습니다.")

        return {
            "data": cafes,
            "source": "kakao-local",
            "ok": True,
            "status": "ok",
            "message": "카카오 로컬 API로 가까운 카페를 찾았습니다.",
            "updatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
        }
    except httpx.HTTPStatusError as error:
        status_code = error.response.status_code
        if status_code in {401, 403}:
            detail = _kakao_error_detail(error.response)
            detail_text = f" ({detail})" if detail else ""
            return _fallback(
                "error",
                f"카카오 로컬 API 인증 오류 HTTP {status_code}{detail_text}. REST API 키와 허용 설정을 확인해 주세요.",
            )

        return _fallback("error", f"카카오 로컬 API 응답 오류 HTTP {status_code}")
    except httpx.RequestError as error:
        return _fallback("error", f"카카오 로컬 API 연결 실패: {type(error).__name__}")
    except Exception as error:
        return _fallback("error", f"카카오 로컬 API 처리 실패: {type(error).__name__}")

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

KMA_ENDPOINT = (
    "https://apis.data.go.kr/1360000/"
    "VilageFcstInfoService_2.0/getUltraSrtNcst"
)
KST = timezone(timedelta(hours=9))

FALLBACK_WEATHER = {
    "location": "경기 화성시 남양읍",
    "temperatureC": 33,
    "humidityPercent": 68,
    "heatRisk": "높음",
    "source": "mockData",
    "updatedAt": "발표 준비용 데이터",
}


def _service_key() -> str:
    key = os.getenv("KMA_SHORT_TERM_FORECAST_KEY") or os.getenv("PUBLIC_DATA_SERVICE_KEY")
    return unquote(key.strip()) if key else ""


def _grid() -> tuple[int, int]:
    nx = int(os.getenv("KMA_BASE_NX", "57"))
    ny = int(os.getenv("KMA_BASE_NY", "119"))
    return nx, ny


def _base_datetime(now: datetime | None = None) -> tuple[str, str]:
    current = now or datetime.now(KST)
    # 초단기실황은 보통 매시각 자료가 약 40분 이후 안정적으로 조회됩니다.
    if current.minute < 45:
        current = current - timedelta(hours=1)

    return current.strftime("%Y%m%d"), current.strftime("%H00")


def _heat_risk(temperature: float, humidity: int) -> str:
    if temperature >= 35 or (temperature >= 33 and humidity >= 65):
        return "높음"

    if temperature >= 30 or humidity >= 70:
        return "주의"

    return "낮음"


def _fallback(message: str) -> dict[str, object]:
    return {
        **FALLBACK_WEATHER,
        "ok": False,
        "message": message,
    }


def _http_error_message(error: httpx.HTTPStatusError) -> str:
    status_code = error.response.status_code

    if status_code == 429:
        return "기상청 API 요청이 잠시 많아 mockData를 사용합니다. 잠시 후 다시 확인해 주세요."

    return f"기상청 API 응답 오류 HTTP {status_code}"


def _items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    response = payload.get("response", {})
    header = response.get("header", {})
    result_code = str(header.get("resultCode", ""))

    if result_code and result_code != "00":
        message = header.get("resultMsg") or "기상청 API 응답 오류"
        raise ValueError(str(message))

    items = response.get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]

    if isinstance(items, list):
        return items

    return []


def _parse_weather(payload: dict[str, Any], base_date: str, base_time: str) -> dict[str, object]:
    values: dict[str, str] = {}
    for item in _items(payload):
        category = item.get("category")
        value = item.get("obsrValue")
        if category and value is not None:
            values[str(category)] = str(value)

    if "T1H" not in values or "REH" not in values:
        raise ValueError("기온(T1H) 또는 습도(REH) 값이 없습니다.")

    temperature = float(values["T1H"])
    humidity = int(float(values["REH"]))

    return {
        "location": "경기 화성시",
        "temperatureC": temperature,
        "humidityPercent": humidity,
        "heatRisk": _heat_risk(temperature, humidity),
        "source": "kma",
        "updatedAt": f"{base_date} {base_time}",
        "ok": True,
        "message": "기상청 초단기실황 데이터를 사용합니다.",
    }


async def get_weather() -> dict[str, object]:
    key = _service_key()
    if not key:
        return _fallback("기상청 API 키가 없어 mockData를 사용합니다.")

    try:
        base_date, base_time = _base_datetime()
        nx, ny = _grid()
        params = {
            "serviceKey": key,
            "pageNo": "1",
            "numOfRows": "1000",
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": str(nx),
            "ny": str(ny),
        }

        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(KMA_ENDPOINT, params=params)
            response.raise_for_status()
            return _parse_weather(response.json(), base_date, base_time)
    except httpx.HTTPStatusError as error:
        return _fallback(_http_error_message(error))
    except httpx.RequestError:
        return _fallback("기상청 API 연결이 불안정해 mockData를 사용합니다.")
    except Exception as error:
        return _fallback(f"기상청 API 처리 실패: {type(error).__name__}")

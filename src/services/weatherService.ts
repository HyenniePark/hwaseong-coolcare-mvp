import { mockWeather } from "../data/mockData";

export interface WeatherData {
  location: string;
  temperatureC: number;
  humidityPercent: number;
  heatRisk: string;
  source: string;
  updatedAt: string;
  ok?: boolean;
  message?: string;
}

export interface WeatherLoadResult {
  data: WeatherData;
  source: "api" | "mock";
  ok: boolean;
  message: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

function mockWeatherResult(message: string): WeatherLoadResult {
  return {
    data: mockWeather,
    source: "mock",
    ok: false,
    message,
  };
}

export async function fetchWeatherWithFallback(): Promise<WeatherLoadResult> {
  if (!apiBaseUrl) {
    return mockWeatherResult("VITE_API_BASE_URL이 없어 mockData를 사용합니다.");
  }

  try {
    const response = await fetch(apiBaseUrl + "/api/weather");
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = (await response.json()) as WeatherData;
    return {
      data,
      source: data.source === "mockData" ? "mock" : "api",
      ok: data.ok !== false,
      message: data.message || "날씨 데이터를 불러왔습니다.",
    };
  } catch (error) {
    return mockWeatherResult("날씨 API 호출 실패: " + String(error));
  }
}

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
const weatherRetryDelaysMs = [0, 1200, 3000];

function mockWeatherResult(message: string): WeatherLoadResult {
  return {
    data: mockWeather,
    source: "mock",
    ok: false,
    message,
  };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function weatherErrorMessage(error: unknown) {
  const text = String(error);

  if (text.includes("Failed to fetch")) {
    return "날씨 API 연결 실패: Render 백엔드가 잠시 깨어나는 중이거나 현재 Vercel 주소가 허용되지 않았습니다.";
  }

  return "날씨 API 호출 실패: " + text;
}

async function fetchWeatherFromApi(baseUrl: string): Promise<WeatherData> {
  let lastError: unknown;

  for (const delayMs of weatherRetryDelaysMs) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      const response = await fetch(baseUrl + "/api/weather", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return (await response.json()) as WeatherData;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function fetchWeatherWithFallback(): Promise<WeatherLoadResult> {
  if (!apiBaseUrl) {
    return mockWeatherResult("VITE_API_BASE_URL이 없어 mockData를 사용합니다.");
  }

  try {
    const data = await fetchWeatherFromApi(apiBaseUrl);
    return {
      data,
      source: data.source === "mockData" ? "mock" : "api",
      ok: data.ok !== false,
      message: data.message || "날씨 데이터를 불러왔습니다.",
    };
  } catch (error) {
    return mockWeatherResult(weatherErrorMessage(error));
  }
}

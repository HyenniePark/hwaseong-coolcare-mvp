import { generatedHospitals } from "../data/generatedHospitals";
import { mockHospitals, mockShelters, mockWeather } from "../data/mockData";
import type { CoolingShelter, MedicalFacility } from "../types";

export type DataSourceKind = "api" | "csv" | "mock";

export interface DataLoadResult<T> {
  data: T;
  source: DataSourceKind;
  ok: boolean;
  message: string;
}

interface ShelterApiResponse {
  data?: CoolingShelter[];
  shelters?: CoolingShelter[];
  source?: string;
  ok?: boolean;
  message?: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

function hasUsableCoordinates(item: MedicalFacility | CoolingShelter) {
  return Number.isFinite(item.lat) && Number.isFinite(item.lng);
}

function hasUsableHospitalFields(item: MedicalFacility) {
  return Boolean(item.id && item.name && item.address && item.phone && hasUsableCoordinates(item));
}

function hasUsableShelterFields(item: CoolingShelter) {
  return Boolean(item.id && item.name && item.address && hasUsableCoordinates(item));
}

function shelterMockResult(message: string): DataLoadResult<CoolingShelter[]> {
  return {
    data: mockShelters,
    source: "mock",
    ok: false,
    message,
  };
}

export function getHospitalsWithFallback(): DataLoadResult<MedicalFacility[]> {
  const csvHospitals = generatedHospitals.filter(hasUsableHospitalFields);

  if (csvHospitals.length > 0) {
    return {
      data: csvHospitals,
      source: "csv",
      ok: true,
      message: "화성시 의료기관 CSV 데이터를 사용합니다.",
    };
  }

  return {
    data: mockHospitals,
    source: "mock",
    ok: false,
    message: "CSV 의료기관 데이터가 비어 있어 mockData를 사용합니다.",
  };
}

export function getSheltersWithFallback(): DataLoadResult<CoolingShelter[]> {
  return shelterMockResult("무더위쉼터 데이터를 불러오는 중입니다. 실패하면 mockData를 사용합니다.");
}

export async function fetchSheltersWithFallback(): Promise<DataLoadResult<CoolingShelter[]>> {
  if (!apiBaseUrl) {
    return shelterMockResult("VITE_API_BASE_URL이 없어 무더위쉼터 mockData를 사용합니다.");
  }

  try {
    const response = await fetch(apiBaseUrl + "/api/shelters", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const payload = (await response.json()) as ShelterApiResponse;
    const apiShelters = (payload.data || payload.shelters || []).filter(hasUsableShelterFields);

    if (payload.ok !== false && apiShelters.length > 0) {
      return {
        data: apiShelters,
        source: "api",
        ok: true,
        message: payload.message || "무더위쉼터 API 데이터를 사용합니다.",
      };
    }

    return shelterMockResult(payload.message || "무더위쉼터 API 데이터가 비어 있어 mockData를 사용합니다.");
  } catch (error) {
    return shelterMockResult("무더위쉼터 API 호출 실패: " + String(error));
  }
}

export function getWeatherWithFallback() {
  return {
    data: mockWeather,
    source: "mock" as const,
    ok: true,
    message: "기상청 API 연결 전에는 mockData를 사용합니다.",
  };
}

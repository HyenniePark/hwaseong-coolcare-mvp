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

function hasUsableCoordinates(item: MedicalFacility) {
  return Number.isFinite(item.lat) && Number.isFinite(item.lng);
}

function hasUsableHospitalFields(item: MedicalFacility) {
  return Boolean(item.id && item.name && item.address && item.phone && hasUsableCoordinates(item));
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
  return {
    data: mockShelters,
    source: "mock",
    ok: true,
    message: "무더위쉼터 API 승인 전이므로 mockData를 사용합니다.",
  };
}

export function getWeatherWithFallback() {
  return {
    data: mockWeather,
    source: "mock" as const,
    ok: true,
    message: "기상청 API 연결 전에는 mockData를 사용합니다.",
  };
}

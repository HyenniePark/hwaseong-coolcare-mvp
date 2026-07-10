import type { CafePlace, GeoPoint } from "../types";

export type NearbyCafeSearchStatus = "ok" | "no-key" | "sdk-unavailable" | "zero-result" | "error";

export type NearbyCafeSearchResult = {
  cafes: CafePlace[];
  status: NearbyCafeSearchStatus;
  message: string;
};

type CafeApiResponse = {
  data?: CafePlace[];
  cafes?: CafePlace[];
  status?: NearbyCafeSearchStatus;
  ok?: boolean;
  message?: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

function hasUsableCafeFields(item: CafePlace) {
  return Boolean(
    item.id &&
      item.name &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng) &&
      Number.isFinite(item.distanceKm),
  );
}

function emptyResult(status: NearbyCafeSearchStatus, message: string): NearbyCafeSearchResult {
  return {
    cafes: [],
    status,
    message,
  };
}

export async function searchNearbyCafes(point: GeoPoint, radiusMeters = 5000): Promise<NearbyCafeSearchResult> {
  if (!apiBaseUrl) {
    return emptyResult("no-key", "VITE_API_BASE_URL이 없어 백엔드 카페 API를 호출할 수 없습니다.");
  }

  const params = new URLSearchParams({
    lat: String(point.lat),
    lng: String(point.lng),
    radius: String(radiusMeters),
  });

  try {
    const response = await fetch(apiBaseUrl + "/api/cafes?" + params.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const payload = (await response.json()) as CafeApiResponse;
    const cafes = (payload.data || payload.cafes || []).filter(hasUsableCafeFields);

    if (payload.ok !== false && cafes.length > 0) {
      return {
        cafes,
        status: "ok",
        message: payload.message || "카카오 로컬 API로 가까운 카페를 찾았습니다.",
      };
    }

    return emptyResult(
      payload.status || "zero-result",
      payload.message || "카카오 로컬 API는 연결됐지만 선택 위치 주변 카페 결과가 없습니다.",
    );
  } catch (error) {
    return emptyResult("error", "백엔드 카페 API 호출 실패: " + String(error));
  }
}

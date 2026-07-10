import type { CafePlace, GeoPoint } from "../types";

type KakaoAddressSearchResult = {
  x?: string;
  y?: string;
  address_name?: string;
};

type KakaoCoordAddressResult = {
  address?: {
    address_name?: string;
  };
  road_address?: {
    address_name?: string;
  };
};

type KakaoStatus = "OK" | "ZERO_RESULT" | "ERROR";

type KakaoPlaceSearchResult = {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  phone?: string;
  place_url?: string;
  x?: string;
  y?: string;
  distance?: string;
};

type KakaoLatLng = unknown;

type KakaoPlaceSearchOptions = {
  location?: KakaoLatLng;
  radius?: number;
  sort?: string;
  size?: number;
};

type KakaoGeocoder = {
  addressSearch: (
    address: string,
    callback: (result: KakaoAddressSearchResult[], status: KakaoStatus) => void,
  ) => void;
  coord2Address: (
    longitude: number,
    latitude: number,
    callback: (result: KakaoCoordAddressResult[], status: KakaoStatus) => void,
  ) => void;
};

type KakaoPlaces = {
  categorySearch: (
    categoryGroupCode: string,
    callback: (result: KakaoPlaceSearchResult[], status: KakaoStatus) => void,
    options?: KakaoPlaceSearchOptions,
  ) => void;
  keywordSearch: (
    keyword: string,
    callback: (result: KakaoPlaceSearchResult[], status: KakaoStatus) => void,
    options?: KakaoPlaceSearchOptions,
  ) => void;
};

type KakaoMapsApi = {
  maps: {
    LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
    load: (callback: () => void) => void;
    services: {
      Geocoder: new () => KakaoGeocoder;
      Places: new () => KakaoPlaces;
      Status: {
        OK: KakaoStatus;
      };
      SortBy: {
        DISTANCE: string;
      };
    };
  };
};

export type NearbyCafeSearchStatus = "ok" | "no-key" | "sdk-unavailable" | "zero-result" | "error";

export type NearbyCafeSearchResult = {
  cafes: CafePlace[];
  status: NearbyCafeSearchStatus;
  message: string;
};

declare global {
  interface Window {
    kakao?: KakaoMapsApi;
  }
}

const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_KEY?.trim();
let kakaoMapsPromise: Promise<KakaoMapsApi | null> | null = null;

function loadKakaoMaps() {
  if (!kakaoMapKey) {
    return Promise.resolve(null);
  }

  if (window.kakao?.maps?.services) {
    return Promise.resolve(window.kakao);
  }

  if (kakaoMapsPromise) {
    return kakaoMapsPromise;
  }

  kakaoMapsPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-map-sdk="true"]');

    const resolveWhenReady = () => {
      const kakao = window.kakao;
      if (!kakao?.maps) {
        resolve(null);
        return;
      }

      kakao.maps.load(() => {
        resolve(kakao.maps.services ? kakao : null);
      });
    };

    if (existing) {
      if (window.kakao?.maps) {
        resolveWhenReady();
        return;
      }

      existing.addEventListener("load", resolveWhenReady, { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.kakaoMapSdk = "true";
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=" +
      encodeURIComponent(kakaoMapKey);
    script.onload = resolveWhenReady;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}

async function getGeocoder() {
  const kakao = await loadKakaoMaps();
  return kakao ? new kakao.maps.services.Geocoder() : null;
}

async function getPlaces() {
  const kakao = await loadKakaoMaps();
  return kakao ? { kakao, places: new kakao.maps.services.Places() } : null;
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const geocoder = await getGeocoder();
  if (!geocoder) {
    return null;
  }

  return new Promise((resolve) => {
    geocoder.addressSearch(address, (result, status) => {
      const first = status === "OK" ? result[0] : undefined;
      const lat = Number(first?.y);
      const lng = Number(first?.x);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        resolve({ lat, lng });
        return;
      }

      resolve(null);
    });
  });
}

export async function reverseGeocodePoint(point: GeoPoint): Promise<string | null> {
  const geocoder = await getGeocoder();
  if (!geocoder) {
    return null;
  }

  return new Promise((resolve) => {
    geocoder.coord2Address(point.lng, point.lat, (result, status) => {
      if (status !== "OK") {
        resolve(null);
        return;
      }

      const first = result[0];
      resolve(first?.road_address?.address_name || first?.address?.address_name || null);
    });
  });
}

function toCafePlace(place: KakaoPlaceSearchResult): CafePlace | null {
  const lat = Number(place.y);
  const lng = Number(place.x);
  const distanceKm = Number(place.distance) / 1000;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !place.place_name) {
    return null;
  }

  return {
    id: place.id || place.place_name + "-" + lat + "-" + lng,
    name: place.place_name,
    address: place.address_name || "",
    roadAddress: place.road_address_name || "",
    lat,
    lng,
    phone: place.phone || "",
    placeUrl: place.place_url || "",
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : 0,
  };
}

function uniquePlaces(places: CafePlace[]) {
  const seen = new Set<string>();

  return places
    .filter((place) => {
      const key = place.id || place.name + place.lat + place.lng;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function searchNearbyCafes(point: GeoPoint, radiusMeters = 5000): Promise<NearbyCafeSearchResult> {
  if (!kakaoMapKey) {
    return {
      cafes: [],
      status: "no-key",
      message: "배포 환경에 카카오 JavaScript 키가 설정되어 있지 않습니다.",
    };
  }

  const placesApi = await getPlaces();
  if (!placesApi) {
    return {
      cafes: [],
      status: "sdk-unavailable",
      message: "카카오 지도 SDK를 불러오지 못했습니다. JavaScript 키 허용 도메인을 확인해 주세요.",
    };
  }

  const { kakao, places } = placesApi;
  const options: KakaoPlaceSearchOptions = {
    location: new kakao.maps.LatLng(point.lat, point.lng),
    radius: radiusMeters,
    sort: kakao.maps.services.SortBy.DISTANCE,
    size: 15,
  };

  const searchByKeyword = () =>
    new Promise<CafePlace[]>((resolve) => {
      places.keywordSearch("카페", (result, status) => {
        if (status !== "OK") {
          resolve([]);
          return;
        }

        resolve(uniquePlaces(result.map(toCafePlace).filter((place): place is CafePlace => Boolean(place))));
      }, options);
    });

  return new Promise((resolve) => {
    places.categorySearch(
      "CE7",
      async (result, status) => {
        if (status !== "OK") {
          const keywordResults = await searchByKeyword();
          resolve({
            cafes: keywordResults,
            status: keywordResults.length > 0 ? "ok" : "zero-result",
            message:
              keywordResults.length > 0
                ? "카테고리 검색 대신 키워드 검색으로 카페를 찾았습니다."
                : "카카오 장소 검색은 연결됐지만 주변 카페 결과를 받지 못했습니다.",
          });
          return;
        }

        const cafes = uniquePlaces(result.map(toCafePlace).filter((place): place is CafePlace => Boolean(place)));

        if (cafes.length > 0) {
          resolve({
            cafes,
            status: "ok",
            message: "카카오 카페 카테고리 검색으로 찾았습니다.",
          });
          return;
        }

        const keywordResults = await searchByKeyword();
        resolve({
          cafes: keywordResults,
          status: keywordResults.length > 0 ? "ok" : "zero-result",
          message:
            keywordResults.length > 0
              ? "카테고리 검색 대신 키워드 검색으로 카페를 찾았습니다."
              : "카카오 장소 검색은 연결됐지만 주변 카페 결과를 받지 못했습니다.",
        });
      },
      options,
    );
  });
}

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
    options?: {
      location?: KakaoLatLng;
      radius?: number;
      sort?: string;
      size?: number;
    },
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

export async function searchNearbyCafes(point: GeoPoint, radiusMeters = 3000): Promise<CafePlace[]> {
  const placesApi = await getPlaces();
  if (!placesApi) {
    return [];
  }

  const { kakao, places } = placesApi;

  return new Promise((resolve) => {
    places.categorySearch(
      "CE7",
      (result, status) => {
        if (status !== "OK") {
          resolve([]);
          return;
        }

        const cafes = result
          .map((place): CafePlace | null => {
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
          })
          .filter((place): place is CafePlace => Boolean(place));

        resolve(cafes);
      },
      {
        location: new kakao.maps.LatLng(point.lat, point.lng),
        radius: radiusMeters,
        sort: kakao.maps.services.SortBy.DISTANCE,
        size: 10,
      },
    );
  });
}

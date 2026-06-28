import type { GeoPoint } from "../types";

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

type KakaoMapsApi = {
  maps: {
    load: (callback: () => void) => void;
    services: {
      Geocoder: new () => KakaoGeocoder;
      Status: {
        OK: KakaoStatus;
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

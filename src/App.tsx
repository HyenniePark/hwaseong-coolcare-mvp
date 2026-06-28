import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bus,
  Car,
  Check,
  ChevronDown,
  Footprints,
  Gauge,
  HeartPulse,
  HelpCircle,
  Home,
  Hospital,
  LocateFixed,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  Siren,
  ThermometerSun,
  UserPlus,
  UserRound,
  UsersRound,
  Wind,
  X,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultLocation,
  cautionSymptoms,
  emergencySymptoms,
  mockWeather,
  symptomLabels,
} from "./data/mockData";
import {
  classifyHospitalRisk,
  classifyRisk,
  distanceKm,
  formatDistance,
  kakaoSearchUrl,
  recommendHospitals,
  recommendShelters,
  selectedSymptomsFromSeverity,
} from "./lib/recommendation";
import { getHospitalsWithFallback, getSheltersWithFallback } from "./services/dataService";
import { geocodeAddress, reverseGeocodePoint } from "./services/kakaoMapService";
import { fetchWeatherWithFallback, type WeatherLoadResult } from "./services/weatherService";
import type {
  ActivityStatus,
  CurrentStatus,
  GeoPoint,
  HospitalSearchStatus,
  ShelterRecommendation,
  ShelterSearchStatus,
  SpecialTrait,
  RiskResult,
  SymptomId,
  TransportMode,
  UserProfile,
  ViewId,
} from "./types";

const durationMaxStep = 20;
const symptomOrder = Object.keys(symptomLabels) as SymptomId[];
type LocationMode = "gps" | "area" | "address";
type LocationCenter = GeoPoint & { label: string };
type AddressCandidate = LocationCenter & { id: string; address: string; note?: string };

const symptomVisuals: Record<SymptomId, { shortLabel: string; hint: string; icon: LucideIcon }> = {
  dizziness: { shortLabel: "어지러움", hint: "빙빙 돌거나 휘청거림", icon: Activity },
  nausea: { shortLabel: "메스꺼움", hint: "속이 울렁거림", icon: HeartPulse },
  headache: { shortLabel: "두통", hint: "머리가 아픔", icon: Gauge },
  heavySweat: { shortLabel: "땀 많음", hint: "땀이 계속 남", icon: Wind },
  muscleCramp: { shortLabel: "근육경련", hint: "쥐가 나거나 뻣뻣함", icon: Activity },
  fatigue: { shortLabel: "피로감", hint: "힘이 빠지고 지침", icon: HeartPulse },
  confusion: { shortLabel: "의식 흐림", hint: "말이 어눌하거나 멍함", icon: AlertTriangle },
  highFever: { shortLabel: "고열", hint: "몸이 매우 뜨거움", icon: ThermometerSun },
  breathingTrouble: { shortLabel: "호흡곤란", hint: "숨쉬기 어려움", icon: Wind },
  repeatedVomiting: { shortLabel: "반복 구토", hint: "계속 토함", icon: Siren },
};

const symptomGroups = [
  {
    title: "흔한 증상",
    description: "해당되는 증상만 눌러주세요.",
    symptoms: cautionSymptoms,
    emergency: false,
  },
  {
    title: "응급 위험 신호",
    description: "있다면 119 상담을 먼저 권장합니다.",
    symptoms: emergencySymptoms,
    emergency: true,
  },
];

const hwaseongDistrictGroups = {
  "동탄구": [
    "동탄1동",
    "동탄2동",
    "동탄3동",
    "동탄4동",
    "동탄5동",
    "동탄6동",
    "동탄7동",
    "동탄8동",
    "동탄9동",
  ],
  "동부구": ["진안동", "반월동", "기배동", "화산동", "병점1동", "병점2동"],
  "서부구": ["남양읍", "매송면", "비봉면", "마도면", "송산면", "서신면"],
  "남부구": ["봉담읍", "우정읍", "향남읍", "팔탄면", "장안면", "양감면", "정남면"],
} as const;

const hwaseongGuOptions = Object.keys(hwaseongDistrictGroups) as Array<
  keyof typeof hwaseongDistrictGroups
>;

const hwaseongLocationCenters: Record<string, LocationCenter> = {
  "동탄구": { label: "동탄구 중심", lat: 37.1992, lng: 127.0984 },
  "동부구": { label: "동부구 중심", lat: 37.206, lng: 127.0335 },
  "서부구": { label: "서부구 중심", lat: 37.2054, lng: 126.8168 },
  "남부구": { label: "남부구 중심", lat: 37.1318, lng: 126.9209 },
  "동탄1동": { label: "동탄1동 중심", lat: 37.2067, lng: 127.0724 },
  "동탄2동": { label: "동탄2동 중심", lat: 37.1942, lng: 127.0831 },
  "동탄3동": { label: "동탄3동 중심", lat: 37.2101, lng: 127.0613 },
  "동탄4동": { label: "동탄4동 중심", lat: 37.1769, lng: 127.1054 },
  "동탄5동": { label: "동탄5동 중심", lat: 37.1883, lng: 127.1117 },
  "동탄6동": { label: "동탄6동 중심", lat: 37.1704, lng: 127.0959 },
  "동탄7동": { label: "동탄7동 중심", lat: 37.1992, lng: 127.0984 },
  "동탄8동": { label: "동탄8동 중심", lat: 37.1836, lng: 127.1212 },
  "동탄9동": { label: "동탄9동 중심", lat: 37.1695, lng: 127.1165 },
  "진안동": { label: "진안동 중심", lat: 37.2139, lng: 127.0357 },
  "반월동": { label: "반월동 중심", lat: 37.2256, lng: 127.0598 },
  "기배동": { label: "기배동 중심", lat: 37.2212, lng: 126.9817 },
  "화산동": { label: "화산동 중심", lat: 37.2059, lng: 127.0101 },
  "병점1동": { label: "병점1동 중심", lat: 37.206, lng: 127.0335 },
  "병점2동": { label: "병점2동 중심", lat: 37.2119, lng: 127.0448 },
  "남양읍": { label: "남양읍 중심", lat: 37.2117, lng: 126.8168 },
  "매송면": { label: "매송면 중심", lat: 37.2492, lng: 126.9045 },
  "비봉면": { label: "비봉면 중심", lat: 37.2357, lng: 126.8748 },
  "마도면": { label: "마도면 중심", lat: 37.2054, lng: 126.7753 },
  "송산면": { label: "송산면 중심", lat: 37.2204, lng: 126.7398 },
  "서신면": { label: "서신면 중심", lat: 37.1665, lng: 126.7082 },
  "봉담읍": { label: "봉담읍 중심", lat: 37.2203, lng: 126.9498 },
  "우정읍": { label: "우정읍 중심", lat: 37.0862, lng: 126.8172 },
  "향남읍": { label: "향남읍 중심", lat: 37.1318, lng: 126.9209 },
  "팔탄면": { label: "팔탄면 중심", lat: 37.1624, lng: 126.9031 },
  "장안면": { label: "장안면 중심", lat: 37.0784, lng: 126.8338 },
  "양감면": { label: "양감면 중심", lat: 37.0818, lng: 126.9563 },
  "정남면": { label: "정남면 중심", lat: 37.1612, lng: 126.9711 },
};

const hwaseongAreaNames = Object.values(hwaseongDistrictGroups).flat() as string[];

function gpsLocationDisplay(point: GeoPoint) {
  const nearest = hwaseongAreaNames
    .map((areaName) => {
      const center = hwaseongLocationCenters[areaName];
      return center ? { areaName, distance: distanceKm(point, center) } : null;
    })
    .filter((item): item is { areaName: string; distance: number } => Boolean(item))
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest ? "화성시 " + nearest.areaName + " 인근" : "GPS 현재 위치";
}

const mockAddressCandidates: AddressCandidate[] = [
  { id: "cityhall", label: "화성시청", address: "경기도 화성시 남양읍 시청로 159", lat: 37.1996, lng: 126.8312 },
  { id: "namyang", label: "남양읍 행정복지센터", address: "경기도 화성시 남양읍 남양성지로 192-5", lat: 37.2117, lng: 126.8168 },
  { id: "hyangnam", label: "향남읍 행정복지센터", address: "경기도 화성시 향남읍 발안로 89", lat: 37.1318, lng: 126.9209 },
  { id: "dongtan", label: "동탄역", address: "경기도 화성시 동탄역로 151", lat: 37.2003, lng: 127.0957 },
  { id: "bongdam", label: "봉담읍 행정복지센터", address: "경기도 화성시 봉담읍 샘마을1길 8", lat: 37.2203, lng: 126.9498 },
  { id: "byeongjeom", label: "병점역", address: "경기도 화성시 병점노을로 12", lat: 37.2073, lng: 127.0341 },
  { id: "mado", label: "마도면 문화센터", address: "경기도 화성시 마도면 마도북로 389", lat: 37.2054, lng: 126.7753 },
];

type DaumPostcodeData = {
  address?: string;
  roadAddress?: string;
  jibunAddress?: string;
  buildingName?: string;
  bname?: string;
  sigungu?: string;
  zonecode?: string;
};

const addressKeywordCenters: Array<{ keyword: string; center: LocationCenter }> = [
  { keyword: "동탄", center: hwaseongLocationCenters["동탄7동"] || { label: "동탄권 중심", lat: 37.1992, lng: 127.0984 } },
  { keyword: "병점", center: hwaseongLocationCenters["병점1동"] || { label: "병점권 중심", lat: 37.206, lng: 127.0335 } },
  { keyword: "진안", center: hwaseongLocationCenters["진안동"] || { label: "진안동 중심", lat: 37.2139, lng: 127.0357 } },
  { keyword: "반월", center: hwaseongLocationCenters["반월동"] || { label: "반월동 중심", lat: 37.2256, lng: 127.0598 } },
  { keyword: "기배", center: hwaseongLocationCenters["기배동"] || { label: "기배동 중심", lat: 37.2212, lng: 126.9817 } },
  { keyword: "화산", center: hwaseongLocationCenters["화산동"] || { label: "화산동 중심", lat: 37.2059, lng: 127.0101 } },
  { keyword: "남양", center: hwaseongLocationCenters["남양읍"] || { label: "남양읍 중심", lat: 37.2117, lng: 126.8168 } },
  { keyword: "매송", center: hwaseongLocationCenters["매송면"] || { label: "매송면 중심", lat: 37.2492, lng: 126.9045 } },
  { keyword: "비봉", center: hwaseongLocationCenters["비봉면"] || { label: "비봉면 중심", lat: 37.2357, lng: 126.8748 } },
  { keyword: "마도", center: hwaseongLocationCenters["마도면"] || { label: "마도면 중심", lat: 37.2054, lng: 126.7753 } },
  { keyword: "송산", center: hwaseongLocationCenters["송산면"] || { label: "송산면 중심", lat: 37.2204, lng: 126.7398 } },
  { keyword: "서신", center: hwaseongLocationCenters["서신면"] || { label: "서신면 중심", lat: 37.1665, lng: 126.7082 } },
  { keyword: "봉담", center: hwaseongLocationCenters["봉담읍"] || { label: "봉담읍 중심", lat: 37.2203, lng: 126.9498 } },
  { keyword: "우정", center: hwaseongLocationCenters["우정읍"] || { label: "우정읍 중심", lat: 37.0862, lng: 126.8172 } },
  { keyword: "향남", center: hwaseongLocationCenters["향남읍"] || { label: "향남읍 중심", lat: 37.1318, lng: 126.9209 } },
  { keyword: "팔탄", center: hwaseongLocationCenters["팔탄면"] || { label: "팔탄면 중심", lat: 37.1624, lng: 126.9031 } },
  { keyword: "장안", center: hwaseongLocationCenters["장안면"] || { label: "장안면 중심", lat: 37.0784, lng: 126.8338 } },
  { keyword: "양감", center: hwaseongLocationCenters["양감면"] || { label: "양감면 중심", lat: 37.0818, lng: 126.9563 } },
  { keyword: "정남", center: hwaseongLocationCenters["정남면"] || { label: "정남면 중심", lat: 37.1612, lng: 126.9711 } },
];

function inferAddressCenter(address: string) {
  return addressKeywordCenters.find((item) => address.includes(item.keyword))?.center;
}

async function addressCandidateFromPostcode(data: DaumPostcodeData): Promise<AddressCandidate> {
  const address = data.roadAddress || data.address || data.jibunAddress || "선택한 주소";
  const center = inferAddressCenter(address) || inferAddressCenter(data.bname || "") || defaultLocation;
  const label = data.buildingName || data.bname || address;
  const geocoded = await geocodeAddress(address);

  if (geocoded) {
    return {
      id: "daum-" + Date.now(),
      label,
      address,
      lat: geocoded.lat,
      lng: geocoded.lng,
      note: "선택 주소의 실제 좌표로 추천을 계산합니다.",
    };
  }

  return {
    id: "daum-" + Date.now(),
    label,
    address,
    lat: center.lat,
    lng: center.lng,
    note: "주소 좌표 변환을 사용할 수 없어 행정구역 중심으로 추천을 계산합니다.",
  };
}

function loadDaumPostcode() {
  return new Promise<any>((resolve, reject) => {
    const win = window as any;
    if (win.daum?.Postcode) {
      resolve(win.daum.Postcode);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-daum-postcode="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).daum.Postcode), { once: true });
      existing.addEventListener("error", () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.dataset.daumPostcode = "true";
    script.onload = () => {
      const postcode = (window as any).daum?.Postcode;
      if (postcode) {
        resolve(postcode);
      } else {
        reject(new Error("주소 검색 기능을 찾지 못했습니다."));
      }
    };
    script.onerror = () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}


const viewItems: Array<{
  id: ViewId;
  label: string;
  easyLabel: string;
  icon: LucideIcon;
}> = [
  { id: "shelter", label: "쉼터 찾기", easyLabel: "쉼터 찾기", icon: Home },
  { id: "hospital", label: "자가 진단", easyLabel: "자가 진단", icon: Hospital },
  { id: "account", label: "계정 정보", easyLabel: "내 정보", icon: UserRound },
  { id: "status", label: "연동 상태", easyLabel: "연동 상태", icon: Gauge },
  { id: "easy", label: "쉬운 안내", easyLabel: "큰 안내", icon: ShieldCheck },
];

const easyViewItems: Array<{
  id: ViewId;
  label: string;
  easyLabel: string;
  icon: LucideIcon;
}> = [
  { id: "easy", label: "쉬운 안내", easyLabel: "큰 안내", icon: ShieldCheck },
  { id: "shelter", label: "쉼터 찾기", easyLabel: "쉼터 찾기", icon: Home },
  { id: "hospital", label: "자가 진단", easyLabel: "자가 진단", icon: Hospital },
  { id: "account", label: "계정 정보", easyLabel: "내 정보", icon: UserRound },
];

const initialProfile: UserProfile = {
  displayName: "",
  phone: "",
  homeGu: "",
  homeArea: "",
  age: 0,
  hasChronicDisease: false,
  hasAirConditioner: false,
  transport: "",
  traits: [],
  easyMode: false,
};

const initialShelterStatus: ShelterSearchStatus = {
  activityStatus: "indoor",
  outdoorMinutes: 0,
  hasEmergencySignal: false,
};

const initialHospitalStatus: HospitalSearchStatus = {
  severities: {
    dizziness: 0,
    nausea: 0,
    headache: 0,
    heavySweat: 0,
    muscleCramp: 0,
    fatigue: 0,
    confusion: 0,
    highFever: 0,
    breathingTrouble: 0,
    repeatedVomiting: 0,
  },
  emergencyFromShelter: false,
};

function clsx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function durationStepFromMinutes(minutes: number) {
  return Math.min(durationMaxStep, Math.max(0, Math.ceil(minutes / 30)));
}

function durationMinutesFromStep(step: number) {
  return Math.min(durationMaxStep, Math.max(0, step)) * 30;
}

function durationLabel(minutes: number) {
  if (minutes >= 600) {
    return "10시간 이상";
  }

  if (minutes === 0) {
    return "0분";
  }

  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;

  if (hours === 0) {
    return remain + "분";
  }

  if (remain === 0) {
    return hours + "시간";
  }

  return hours + "시간 " + remain + "분";
}

function shelterToCurrentStatus(status: ShelterSearchStatus): CurrentStatus {
  return {
    activityStatus: status.activityStatus,
    outdoorMinutes: status.outdoorMinutes,
    symptoms: status.hasEmergencySignal ? ["confusion"] : [],
  };
}

function hospitalToCurrentStatus(status: HospitalSearchStatus): CurrentStatus {
  const symptoms = selectedSymptomsFromSeverity(status.severities);

  return {
    activityStatus: "indoor",
    outdoorMinutes: 0,
    symptoms: status.emergencyFromShelter && symptoms.length === 0 ? ["confusion"] : symptoms,
  };
}

function mergeRisk(a: ReturnType<typeof classifyRisk>, b: ReturnType<typeof classifyHospitalRisk>) {
  if (a.level === "emergency" || b.level === "emergency") {
    return a.level === "emergency" ? a : b;
  }

  if (a.level === "caution" || b.level === "caution") {
    return a.level === "caution" ? a : b;
  }

  return a;
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>("account");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [shelterStatus, setShelterStatus] = useState<ShelterSearchStatus>(initialShelterStatus);
  const [hospitalStatus, setHospitalStatus] = useState<HospitalSearchStatus>(initialHospitalStatus);
  const [shelterSubmitted, setShelterSubmitted] = useState(false);
  const [hospitalSubmitted, setHospitalSubmitted] = useState(false);
  const [dismissedEmergencyDialog, setDismissedEmergencyDialog] = useState(false);
  const [showEasyPrompt, setShowEasyPrompt] = useState(false);
  const [showBasicModePrompt, setShowBasicModePrompt] = useState(false);
  const [location, setLocation] = useState<GeoPoint>({
    lat: defaultLocation.lat,
    lng: defaultLocation.lng,
  });
  const [locationMode, setLocationMode] = useState<LocationMode>("area");
  const locationRequestId = useRef(0);
  const [selectedAddress, setSelectedAddress] = useState<AddressCandidate | null>(null);
  const [locationDisplay, setLocationDisplay] = useState(defaultLocation.label);
  const [locationNote, setLocationNote] = useState(
    "계정 정보에 활동 지역이 없어 임시 기준을 사용합니다.",
  );
  const [weatherResult, setWeatherResult] = useState<WeatherLoadResult>({
    data: mockWeather,
    source: "mock",
    ok: false,
    message: "날씨 데이터를 불러오는 중입니다.",
  });

  const shelterDataset = useMemo(() => getSheltersWithFallback(), []);
  const hospitalDataset = useMemo(() => getHospitalsWithFallback(), []);
  const shelters = shelterDataset.data;
  const hospitals = hospitalDataset.data;
  const weather = weatherResult.data;

  useEffect(() => {
    let cancelled = false;

    fetchWeatherWithFallback().then((result) => {
      if (!cancelled) {
        setWeatherResult(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);
  const shelterCurrentStatus = useMemo(() => shelterToCurrentStatus(shelterStatus), [shelterStatus]);
  const hospitalCurrentStatus = useMemo(() => hospitalToCurrentStatus(hospitalStatus), [hospitalStatus]);
  const shelterRisk = useMemo(() => classifyRisk(profile, shelterCurrentStatus, weather), [profile, shelterCurrentStatus, weather]);
  const hospitalRisk = useMemo(() => classifyHospitalRisk(profile, hospitalStatus, weather), [profile, hospitalStatus, weather]);
  const combinedRisk = useMemo(() => mergeRisk(shelterRisk, hospitalRisk), [shelterRisk, hospitalRisk]);

  const shelterRecommendations = useMemo(
    () => recommendShelters(shelters, hospitals, profile, shelterCurrentStatus, location, weather),
    [shelters, hospitals, profile, shelterCurrentStatus, location, weather],
  );

  const hospitalRecommendations = useMemo(
    () => recommendHospitals(hospitals, hospitalCurrentStatus, location, profile, weather),
    [hospitals, hospitalCurrentStatus, location, profile, weather],
  );

  useEffect(() => {
    if (!shelterStatus.hasEmergencySignal) {
      setDismissedEmergencyDialog(false);
    }
  }, [shelterStatus.hasEmergencySignal]);

  const shouldShowEmergencyDialog =
    activeView === "shelterResult" &&
    shelterSubmitted &&
    shelterStatus.hasEmergencySignal &&
    !dismissedEmergencyDialog;

  const activityAreaCenter = () => {
    const areaKey = profile.homeArea || profile.homeGu;
    return areaKey ? hwaseongLocationCenters[areaKey] : undefined;
  };

  const useActivityAreaLocation = () => {
    const center = activityAreaCenter();
    locationRequestId.current += 1;
    setLocationMode("area");
    setSelectedAddress(null);

    if (!center) {
      setLocation({ lat: defaultLocation.lat, lng: defaultLocation.lng });
      setLocationDisplay(defaultLocation.label);
      setLocationNote("계정 정보에 활동 지역이 없어 임시 기준을 사용합니다.");
      return;
    }

    setLocation({ lat: center.lat, lng: center.lng });
    setLocationDisplay(center.label);
    setLocationNote("");
  };

  const fallbackToActivityArea = (reason: string) => {
    const center = activityAreaCenter();
    setLocationMode("area");
    setSelectedAddress(null);

    if (center) {
      setLocation({ lat: center.lat, lng: center.lng });
      setLocationDisplay(center.label);
      setLocationNote(reason + " 활동 지역 중심으로 추천을 계산합니다.");
      return;
    }

    setLocation({ lat: defaultLocation.lat, lng: defaultLocation.lng });
    setLocationDisplay(defaultLocation.label);
    setLocationNote(reason + " 활동 지역 정보가 없어 임시 기준으로 추천을 계산합니다.");
  };

  const requestLocation = () => {
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    setLocationMode("gps");
    setSelectedAddress(null);

    if (!navigator.geolocation) {
      fallbackToActivityArea("현재 브라우저에서 GPS를 사용할 수 없습니다.");
      return;
    }

    setLocationDisplay("GPS 현재 위치 확인 중");
    setLocationNote("브라우저 위치 권한 창에서 허용을 눌러주세요.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(currentLocation);
        setLocationDisplay(gpsLocationDisplay(currentLocation));
        setLocationNote("");
        void reverseGeocodePoint(currentLocation).then((address) => {
          if (locationRequestId.current !== requestId || !address) {
            return;
          }

          setLocationDisplay(address + " 인근");
        });
      },
      (error) => {
        const reason =
          error.code === error.PERMISSION_DENIED
            ? "위치 권한이 차단되었습니다."
            : error.code === error.TIMEOUT
              ? "GPS 응답이 늦어졌습니다."
              : "GPS 위치 확인에 실패했습니다.";
        fallbackToActivityArea(reason);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const useAddressLocation = (address: AddressCandidate) => {
    locationRequestId.current += 1;
    setLocationMode("address");
    setSelectedAddress(address);
    setLocation({ lat: address.lat, lng: address.lng });
    setLocationDisplay(address.label);
    setLocationNote(address.note || "");
  };

  useEffect(() => {
    if (locationMode !== "area") {
      return;
    }

    const areaKey = profile.homeArea || profile.homeGu;
    const center = areaKey ? hwaseongLocationCenters[areaKey] : undefined;

    if (!center) {
      setLocation({ lat: defaultLocation.lat, lng: defaultLocation.lng });
      setLocationDisplay(defaultLocation.label);
      setLocationNote("계정 정보에 활동 지역이 없어 임시 기준을 사용합니다.");
      return;
    }

    setLocation({ lat: center.lat, lng: center.lng });
    setLocationDisplay(center.label);
    setLocationNote("");
  }, [profile.homeArea, profile.homeGu, locationMode]);

  const updateShelterStatus = (next: ShelterSearchStatus) => {
    setShelterStatus(next);
    setShelterSubmitted(false);
    if (!next.hasEmergencySignal) {
      setDismissedEmergencyDialog(false);
    }
  };

  const updateHospitalStatus = (next: HospitalSearchStatus) => {
    setHospitalStatus(next);
    setHospitalSubmitted(false);
  };

  const enableBasicMode = () => {
    setProfile({ ...profile, easyMode: false });
    setShowEasyPrompt(false);
    setShowBasicModePrompt(false);
    if (activeView === "easy") {
      setActiveView("account");
    }
  };

  const openView = (view: ViewId) => {
    if (view === "easy" && !profile.easyMode) {
      setShowEasyPrompt(true);
      setMenuOpen(false);
      return;
    }

    setActiveView(view);
    setMenuOpen(false);
  };

  return (
    <main className={clsx("app-shell", profile.easyMode && "easy-shell")}>
      <header className="mb-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {!profile.easyMode && (
              <button
                type="button"
                className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink shadow-soft"
                onClick={() => setMenuOpen(true)}
                aria-label="메뉴 열기"
              >
                <Menu size={24} aria-hidden="true" />
              </button>
            )}
            <div>
              <p className="text-sm font-bold text-cool">공모전용 mock MVP</p>
              <h1 className="mt-1 text-3xl font-black text-ink">화성 쿨케어</h1>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {profile.easyMode
                  ? "큰 아이콘으로 지금 필요한 행동을 먼저 보여줍니다."
                  : "왼쪽 메뉴에서 필요한 화면을 열어 추천을 확인합니다."}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-3 text-cool shadow-soft">
            <ThermometerSun size={28} aria-hidden="true" />
          </div>
        </div>

        {profile.easyMode && (
          <EasyTopMenu activeView={activeView} onSelect={openView} onBasicMode={() => setShowBasicModePrompt(true)} />
        )}
      </header>

      {!profile.easyMode && menuOpen && (
        <SideDrawer
          activeView={activeView}
          onSelect={openView}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {activeView === "account" && (
        <AccountView
          profile={profile}
          setProfile={setProfile}
          onComplete={() => openView("shelter")}
        />
      )}
      {activeView === "status" && (
        <IntegrationStatusView
          weatherResult={weatherResult}
          shelterDataset={shelterDataset}
          hospitalDataset={hospitalDataset}
        />
      )}
      {activeView === "shelter" && (
        profile.easyMode ? (
          <EasyShelterFinderView
            status={shelterStatus}
            setStatus={updateShelterStatus}
            onSubmit={() => {
              setShelterSubmitted(true);
              setDismissedEmergencyDialog(false);
              setActiveView("shelterResult");
            }}
            locationMode={locationMode}
            locationDisplay={locationDisplay}
            locationNote={locationNote}
            selectedAddressLabel={selectedAddress?.label || ""}
            requestLocation={requestLocation}
            useActivityAreaLocation={useActivityAreaLocation}
            useAddressLocation={useAddressLocation}
          />
        ) : (
          <ShelterFinderView
            profile={profile}
            status={shelterStatus}
            setStatus={updateShelterStatus}
            onSubmit={() => {
              setShelterSubmitted(true);
              setDismissedEmergencyDialog(false);
              setActiveView("shelterResult");
            }}
            locationMode={locationMode}
            locationDisplay={locationDisplay}
            locationNote={locationNote}
            selectedAddressLabel={selectedAddress?.label || ""}
            requestLocation={requestLocation}
            useActivityAreaLocation={useActivityAreaLocation}
            useAddressLocation={useAddressLocation}
          />
        )
      )}
      {activeView === "shelterResult" && (
        profile.easyMode ? (
          <EasyShelterResultView
            risk={shelterRisk}
            recommendations={shelterRecommendations}
            onEdit={() => setActiveView("shelter")}
            onOpenHospital={() => setActiveView("hospital")}
          />
        ) : (
          <ShelterResultView
            risk={shelterRisk}
            recommendations={shelterRecommendations}
            weather={weatherResult}
            onEdit={() => setActiveView("shelter")}
          />
        )
      )}
      {activeView === "hospital" && (
        profile.easyMode ? (
          <EasyHospitalFinderView
            status={hospitalStatus}
            setStatus={updateHospitalStatus}
            onSubmit={() => {
              setHospitalSubmitted(true);
              setActiveView("hospitalResult");
            }}
          />
        ) : (
          <HospitalFinderView
            status={hospitalStatus}
            setStatus={updateHospitalStatus}
            onSubmit={() => {
              setHospitalSubmitted(true);
              setActiveView("hospitalResult");
            }}
          />
        )
      )}
      {activeView === "hospitalResult" && (
        profile.easyMode ? (
          <EasyHospitalResultView
            risk={hospitalRisk}
            hospitals={hospitalRecommendations}
            onEdit={() => setActiveView("hospital")}
          />
        ) : (
          <HospitalResultView
            risk={hospitalRisk}
            hospitals={hospitalRecommendations}
            weather={weatherResult}
            onEdit={() => setActiveView("hospital")}
          />
        )
      )}
      {activeView === "easy" && profile.easyMode && (
        <EasyModeView
          risk={combinedRisk}
          shelter={shelterRecommendations[0]}
          hospital={hospitalRecommendations[0]}
          onBasicMode={() => setShowBasicModePrompt(true)}
          onOpenShelter={() => openView("shelter")}
          onOpenHospital={() => openView("hospital")}
        />
      )}

      {showEasyPrompt && (
        <EasyEnableDialog
          onEnable={() => {
            setProfile({ ...profile, easyMode: true });
            setShowEasyPrompt(false);
            setActiveView("easy");
          }}
          onClose={() => setShowEasyPrompt(false)}
        />
      )}

      {showBasicModePrompt && (
        <BasicModeDialog
          onConfirm={enableBasicMode}
          onClose={() => setShowBasicModePrompt(false)}
        />
      )}

      {shouldShowEmergencyDialog && (
        <EmergencyDialog
          onGoHospital={() => {
            setHospitalStatus({ ...hospitalStatus, emergencyFromShelter: true });
            setHospitalSubmitted(true);
            setDismissedEmergencyDialog(true);
            setActiveView("hospital");
          }}
          onStayShelter={() => setDismissedEmergencyDialog(true)}
          onClose={() => setDismissedEmergencyDialog(true)}
        />
      )}
    </main>
  );
}

function SideDrawer({
  activeView,
  onSelect,
  onClose,
}: {
  activeView: ViewId;
  onSelect: (view: ViewId) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/45" role="dialog" aria-modal="true" aria-label="화면 메뉴">
      <aside className="h-full w-[82vw] max-w-xs border-r border-line bg-white p-4 shadow-soft">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-cool">메뉴</p>
            <h2 className="text-xl font-black">화성 쿨케어</h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-2">
          {viewItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={clsx(
                  "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-3 text-left font-black transition",
                  activeView === item.id
                    ? "border-cool bg-orange-50 text-cool"
                    : "border-line bg-white text-ink hover:border-cool",
                )}
                onClick={() => onSelect(item.id)}
              >
                <Icon size={23} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function EasyTopMenu({
  activeView,
  onSelect,
  onBasicMode,
}: {
  activeView: ViewId;
  onSelect: (view: ViewId) => void;
  onBasicMode: () => void;
}) {
  return (
    <nav className="grid grid-cols-2 gap-2" aria-label="쉬운 메뉴">
      {easyViewItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={clsx(
              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center text-lg font-black transition",
              activeView === item.id
                ? "border-cool bg-orange-50 text-cool"
                : "border-line bg-white text-stone-700 hover:border-cool",
            )}
          >
            <Icon size={30} aria-hidden="true" />
            {item.easyLabel}
          </button>
        );
      })}
      <button
        type="button"
        className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-white px-2 py-3 text-center text-lg font-black text-ink transition hover:border-cool hover:text-cool"
        onClick={onBasicMode}
      >
        <UserRound size={30} aria-hidden="true" />
        기본 모드
      </button>
    </nav>
  );
}

function AccountView({
  profile,
  setProfile,
  onComplete,
}: {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  onComplete: () => void;
}) {
  const [formError, setFormError] = useState("");
  const [showSeniorPrompt, setShowSeniorPrompt] = useState(false);
  const setField = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setFormError("");
    setProfile({ ...profile, [key]: value });
  };

  const submitAccount = () => {
    const missingFields: string[] = [];

    if (!profile.displayName.trim()) {
      missingFields.push("이름 또는 별명");
    }

    if (profile.age <= 0) {
      missingFields.push("나이");
    }

    if (!profile.transport) {
      missingFields.push("주요 이동수단");
    }

    if (missingFields.length > 0) {
      setFormError(missingFields.join(", ") + "을 입력해 주세요.");
      return;
    }

    if (profile.age >= 65) {
      setShowSeniorPrompt(true);
      return;
    }

    onComplete();
  };

  return (
    <section className="space-y-4">
      <div className="surface">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-orange-50 p-3 text-cool">
            <UserPlus size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-black">계정 정보 입력</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              실제 회원가입은 아니며, 추천에 필요한 기본 정보를 이 화면 안에서만 사용합니다.
            </p>
          </div>
        </div>

        <FieldGroup label="이름 또는 별명" required>
          <input
            value={profile.displayName}
            onChange={(event) => setField("displayName", event.target.value)}
            placeholder="이름 또는 별명을 입력하세요"
            className="min-h-12 w-full rounded-lg border border-line px-3 text-base"
          />
        </FieldGroup>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-black text-stone-700">휴대폰 번호</span>
            <input
              value={profile.phone}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="선택 입력"
              className="min-h-12 w-full rounded-lg border border-line px-3 text-base"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-black text-stone-700">나이 <RequiredMark /></span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="120"
              value={profile.age === 0 ? "" : String(profile.age)}
              onChange={(event) => {
                const rawValue = event.target.value;
                const nextAge = rawValue === "" ? 0 : Math.min(120, Math.max(0, Number(rawValue)));
                setField("age", Number.isFinite(nextAge) ? nextAge : 0);
              }}
              className="min-h-12 w-full rounded-lg border border-line px-3 text-base"
            />
          </label>
        </div>

        <FieldGroup label="주 활동 지역">
          <div className="grid gap-3">
            <label>
              <span className="mb-2 block text-sm font-black text-stone-700">구 선택</span>
              <div className="relative">
                <select
                  value={profile.homeGu}
                  onChange={(event) => {
                    const nextGu = event.target.value as keyof typeof hwaseongDistrictGroups | "";
                    setProfile({
                      ...profile,
                      homeGu: nextGu,
                      homeArea: "",
                    });
                    setFormError("");
                  }}
                  className="min-h-12 w-full appearance-none rounded-lg border border-line bg-white px-3 pr-10 text-base font-semibold"
                >
                  <option value="">구 선택</option>
                  {hwaseongGuOptions.map((gu) => (
                    <option key={gu} value={gu}>
                      {gu}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500" size={20} aria-hidden="true" />
              </div>
            </label>
            <label>
              <span className="mb-2 block text-sm font-black text-stone-700">세부 행정구</span>
              <div className="relative">
                <select
                  value={profile.homeArea}
                  onChange={(event) => setField("homeArea", event.target.value)}
                  disabled={!profile.homeGu}
                  className="min-h-12 w-full appearance-none rounded-lg border border-line bg-white px-3 pr-10 text-base font-semibold disabled:bg-paper disabled:text-stone-400"
                >
                  <option value="">세부 행정구 선택</option>
                  {profile.homeGu && hwaseongDistrictGroups[profile.homeGu as keyof typeof hwaseongDistrictGroups].map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500" size={20} aria-hidden="true" />
              </div>
            </label>
          </div>
        </FieldGroup>

        <FieldGroup
          label="자택 냉방기"
          help="에어컨, 벽걸이/스탠드형 냉방기, 이동식 에어컨, 창문형 에어컨을 포함합니다. 자택 기준으로 선택하세요."
        >
          <BooleanButton
            selected={profile.hasAirConditioner}
            label="냉방기 보유"
            onClick={() => setField("hasAirConditioner", !profile.hasAirConditioner)}
          />
        </FieldGroup>

        <FieldGroup label="주요 이동수단" required>
          <TransportGrid
            selected={profile.transport}
            onSelect={(value) => setField("transport", value)}
          />
        </FieldGroup>

        <FieldGroup label="특이사항">
          <div className="grid grid-cols-2 gap-2">
            <HelpOptionButton
              selected={profile.hasChronicDisease}
              label="만성질환 있음"
              help="예: 고혈압, 당뇨병, 심장질환, 신장질환, 호흡기질환처럼 더위에 취약할 수 있는 지속 관리 질환을 뜻합니다."
              onClick={() => setField("hasChronicDisease", !profile.hasChronicDisease)}
            />
            <HelpOptionButton
              selected={profile.traits.includes("outdoorWorker")}
              label="야외노동자"
              help="건설, 배달, 농업, 시설관리처럼 더운 시간대에 바깥 활동이 많은 경우를 뜻합니다."
              onClick={() => setField("traits", toggleValue(profile.traits, "outdoorWorker"))}
            />
            <HelpOptionButton
              selected={profile.traits.includes("limitedMobility")}
              label="이동 불편"
              help="장시간 보행이 어렵거나 보호 장비, 보조기기, 동행 도움이 필요한 경우를 뜻합니다."
              onClick={() => setField("traits", toggleValue(profile.traits, "limitedMobility"))}
            />
          </div>
        </FieldGroup>

        <div className="mt-5 grid gap-2">
          <button type="button" className="primary-button w-full" onClick={submitAccount}>
            <Check size={18} aria-hidden="true" />
            정보 반영하기
          </button>
          {formError && <p className="text-sm font-bold text-alert">{formError}</p>}
        </div>
      </div>

      {showSeniorPrompt && (
        <SeniorEasyPrompt
          onAccept={() => {
            setProfile({ ...profile, easyMode: true });
            setShowSeniorPrompt(false);
            onComplete();
          }}
          onDecline={() => {
            setProfile({ ...profile, easyMode: false });
            setShowSeniorPrompt(false);
            onComplete();
          }}
          onClose={() => setShowSeniorPrompt(false)}
        />
      )}
    </section>
  );
}

function SeniorEasyPrompt({
  onAccept,
  onDecline,
  onClose,
}: {
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4" role="dialog" aria-modal="true" aria-labelledby="senior-prompt-title">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
        <DialogCloseButton onClick={onClose} label="쉬운모드 팝업 닫기" />
        <div className="flex items-start gap-4 pr-10">
          <div className="rounded-lg bg-orange-50 p-4 text-cool">
            <ShieldCheck size={42} aria-hidden="true" />
          </div>
          <div>
            <h2 id="senior-prompt-title" className="text-2xl font-black leading-8">
              쉬운모드를 사용할까요?
            </h2>
            <p className="mt-3 text-lg font-bold leading-8 text-stone-700">
              큰 글씨와 큰 아이콘으로 쉼터, 자가 진단, 119 버튼을 더 쉽게 볼 수 있습니다.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <button type="button" className="primary-button min-h-16 w-full text-lg" onClick={onAccept}>
            <ShieldCheck size={24} aria-hidden="true" />
            네, 쉬운모드로 볼게요
          </button>
          <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onDecline}>
            기본 모드로 계속 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function ShelterFinderView({
  profile,
  status,
  setStatus,
  onSubmit,
  locationMode,
  locationDisplay,
  locationNote,
  selectedAddressLabel,
  requestLocation,
  useActivityAreaLocation,
  useAddressLocation,
}: {
  profile: UserProfile;
  status: ShelterSearchStatus;
  setStatus: (status: ShelterSearchStatus) => void;
  onSubmit: () => void;
  locationMode: LocationMode;
  locationDisplay: string;
  locationNote: string;
  selectedAddressLabel: string;
  requestLocation: () => void;
  useActivityAreaLocation: () => void;
  useAddressLocation: (address: AddressCandidate) => void;
}) {
  const durationStep = durationStepFromMinutes(status.outdoorMinutes);
  const setField = <K extends keyof ShelterSearchStatus>(key: K, value: ShelterSearchStatus[K]) => {
    setStatus({ ...status, [key]: value });
  };
  const setActivityStatus = (value: ActivityStatus) => {
    setStatus({
      ...status,
      activityStatus: value,
      outdoorMinutes: value === "outdoor" ? status.outdoorMinutes || 30 : 0,
    });
  };

  return (
    <section className="space-y-4">
      <div className="surface">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-orange-50 p-3 text-cool">
            <Home size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-black">쉼터 찾기</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {profile.displayName || "사용자"}님에게 가까운 무더위쉼터를 찾습니다. 정보를 제출하면 새 결과 화면으로 이동합니다.
            </p>
          </div>
        </div>

        <FieldGroup label="지금 어디에 있나요?">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["indoor", "실내"],
              ["outdoor", "실외"],
              ["planned", "외출 예정"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={clsx(
                  "option-button text-center",
                  status.activityStatus === value && "option-button-selected",
                )}
                onClick={() => setActivityStatus(value as ActivityStatus)}
              >
                {label}
              </button>
            ))}
          </div>
        </FieldGroup>

        {status.activityStatus === "outdoor" && (
          <FieldGroup label="바깥 활동 시간">
            <div className="control-panel">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-black">{durationLabel(status.outdoorMinutes)}</span>
                <span className="text-sm text-stone-600">30분 단위</span>
              </div>
              <input
                type="range"
                min="0"
                max={durationMaxStep}
                step="1"
                value={durationStep}
                onChange={(event) =>
                  setField("outdoorMinutes", durationMinutesFromStep(Number(event.target.value)))
                }
                className="mt-4 w-full accent-cool"
                aria-label="바깥 활동 시간"
              />
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-stone-500">
                <span>0분</span>
                <span>5시간</span>
                <span>10시간 이상</span>
              </div>
            </div>
          </FieldGroup>
        )}

        <LocationSelector
          mode={locationMode}
          display={locationDisplay}
          note={locationNote}
          selectedAddressLabel={selectedAddressLabel}
          onUseGps={requestLocation}
          onUseActivityArea={useActivityAreaLocation}
          onUseAddress={useAddressLocation}
        />

        <FieldGroup label="응급 위험 신호가 있나요?">
          <div className="control-panel">
            <p className="mb-3 text-sm leading-6 text-stone-700">
              의식이 흐림, 고열, 호흡곤란, 반복 구토 중 하나라도 있으면 예를 선택하세요.
            </p>
            <YesNoControl
              value={status.hasEmergencySignal}
              yesLabel="예, 있어요"
              noLabel="아니오"
              danger
              onChange={(value) => setField("hasEmergencySignal", value)}
            />
          </div>
        </FieldGroup>

        <button type="button" className="primary-button mt-5 w-full" onClick={onSubmit}>
          <Check size={18} aria-hidden="true" />
          정보 제출하고 쉼터 추천 보기
        </button>
      </div>

    </section>
  );
}

function EasyShelterFinderView({
  status,
  setStatus,
  onSubmit,
  locationMode,
  locationDisplay,
  locationNote,
  selectedAddressLabel,
  requestLocation,
  useActivityAreaLocation,
  useAddressLocation,
}: {
  status: ShelterSearchStatus;
  setStatus: (status: ShelterSearchStatus) => void;
  onSubmit: () => void;
  locationMode: LocationMode;
  locationDisplay: string;
  locationNote: string;
  selectedAddressLabel: string;
  requestLocation: () => void;
  useActivityAreaLocation: () => void;
  useAddressLocation: (address: AddressCandidate) => void;
}) {
  const setField = <K extends keyof ShelterSearchStatus>(key: K, value: ShelterSearchStatus[K]) => {
    setStatus({ ...status, [key]: value });
  };
  const setActivityStatus = (value: ActivityStatus) => {
    setStatus({
      ...status,
      activityStatus: value,
      outdoorMinutes: value === "outdoor" ? status.outdoorMinutes || 30 : 0,
    });
  };

  return (
    <section className="space-y-4">
      <div className="surface border-2 border-cool">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-cool">
            <Home size={38} aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-black text-cool">큰 안내</p>
            <h2 className="text-3xl font-black leading-10">쉼터 찾기</h2>
          </div>
        </div>
        <p className="mt-4 text-xl font-bold leading-9 text-stone-700">
          지금 계신 곳에 맞춰 가까운 무더위쉼터를 찾습니다.
        </p>
      </div>

      <div className="surface">
        <h3 className="text-2xl font-black">지금 어디에 있나요?</h3>
        <div className="mt-4 grid gap-3">
          <EasyChoiceCard
            selected={status.activityStatus === "indoor"}
            icon={Home}
            title="실내"
            description="건물 안에 있어요"
            onClick={() => setActivityStatus("indoor")}
          />
          <EasyChoiceCard
            selected={status.activityStatus === "outdoor"}
            icon={ThermometerSun}
            title="실외"
            description="밖에 있어요"
            onClick={() => setActivityStatus("outdoor")}
          />
          <EasyChoiceCard
            selected={status.activityStatus === "planned"}
            icon={Navigation}
            title="외출 예정"
            description="곧 밖으로 나갈 예정이에요"
            onClick={() => setActivityStatus("planned")}
          />
        </div>
      </div>

      {status.activityStatus === "outdoor" && (
        <EasyDurationPicker
          minutes={status.outdoorMinutes}
          onChange={(minutes) => setField("outdoorMinutes", minutes)}
        />
      )}

      <EasyLocationSelector
        mode={locationMode}
        display={locationDisplay}
        note={locationNote}
        selectedAddressLabel={selectedAddressLabel}
        onUseGps={requestLocation}
        onUseActivityArea={useActivityAreaLocation}
        onUseAddress={useAddressLocation}
      />

      <div className="surface">
        <h3 className="text-2xl font-black">응급 위험 신호가 있나요?</h3>
        <p className="mt-2 text-lg font-bold leading-8 text-stone-700">
          의식이 흐림, 고열, 호흡곤란, 반복 구토가 있으면 “있어요”를 누르세요.
        </p>
        <div className="mt-4 grid gap-3">
          <EasyChoiceCard
            selected={!status.hasEmergencySignal}
            icon={ShieldCheck}
            title="없어요"
            description="쉼터 추천을 먼저 볼게요"
            onClick={() => setField("hasEmergencySignal", false)}
          />
          <EasyChoiceCard
            selected={status.hasEmergencySignal}
            icon={Siren}
            title="있어요"
            description="119 상담과 병원 확인이 먼저 필요할 수 있어요"
            danger
            onClick={() => setField("hasEmergencySignal", true)}
          />
        </div>
      </div>

      <button type="button" className="primary-button min-h-20 w-full text-xl" onClick={onSubmit}>
        <Check size={28} aria-hidden="true" />
        쉼터 추천 보기
      </button>
    </section>
  );
}

function HospitalFinderView({
  status,
  setStatus,
  onSubmit,
}: {
  status: HospitalSearchStatus;
  setStatus: (status: HospitalSearchStatus) => void;
  onSubmit: () => void;
}) {
  const setSeverity = (symptom: SymptomId, value: number) => {
    setStatus({
      ...status,
      severities: { ...status.severities, [symptom]: value },
    });
  };
  const selectedSymptoms = symptomOrder.filter((symptom) => status.severities[symptom] > 0);
  const clearSymptoms = () => {
    setStatus({ ...status, severities: initialHospitalStatus.severities });
  };

  return (
    <section className="space-y-4">
      <div className="surface">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-river">
            <Hospital size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-black">자가 진단</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              증상이 있는지 먼저 고르고, 있다고 체크한 증상만 강도를 입력합니다.
            </p>
          </div>
        </div>

        {status.emergencyFromShelter && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-1 text-alert" size={20} aria-hidden="true" />
              <p className="text-sm font-bold leading-6 text-alert">
                쉼터 찾기에서 응급 위험 신호가 체크되어 병원 후보를 먼저 보여줍니다.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button mt-3 w-full"
              onClick={() => setStatus({ ...status, emergencyFromShelter: false })}
            >
              응급 체크 해제
            </button>
          </div>
        )}

        <FieldGroup label="증상 선택">
          <div className="control-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-stone-700">
                  {selectedSymptoms.length > 0 ? selectedSymptoms.length + "개 선택됨" : "증상이 있으면 눌러주세요"}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-stone-500">
                  선택한 증상만 아래에서 강도를 조절합니다.
                </p>
              </div>
              {selectedSymptoms.length > 0 && (
                <button type="button" className="text-xs font-black text-stone-500 underline" onClick={clearSymptoms}>
                  모두 해제
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {symptomGroups.map((group) => (
                <section key={group.title}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className={clsx("text-sm font-black", group.emergency ? "text-alert" : "text-river")}>
                      {group.title}
                    </h3>
                    <span className="text-xs font-bold text-stone-500">{group.description}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.symptoms.map((symptom) => (
                      <SymptomToggleCard
                        key={symptom}
                        symptom={symptom}
                        selected={status.severities[symptom] > 0}
                        emergency={group.emergency}
                        onToggle={() => setSeverity(symptom, status.severities[symptom] > 0 ? 0 : 1)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {selectedSymptoms.length > 0 && (
            <div className="mt-3 rounded-lg border border-line bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-stone-700">선택한 증상 강도</h3>
                <span className="text-xs font-bold text-stone-500">1 약함 · 5 강함</span>
              </div>
              <div className="space-y-3">
                {selectedSymptoms.map((symptom) => (
                  <SymptomSeverityControl
                    key={symptom}
                    symptom={symptom}
                    value={status.severities[symptom]}
                    onChange={(value) => setSeverity(symptom, value)}
                    onClear={() => setSeverity(symptom, 0)}
                  />
                ))}
              </div>
            </div>
          )}
        </FieldGroup>

        <button type="button" className="primary-button mt-5 w-full" onClick={onSubmit}>
          <Check size={18} aria-hidden="true" />
          정보 제출하고 자가 진단 보기
        </button>
      </div>
    </section>
  );
}

function EasyHospitalFinderView({
  status,
  setStatus,
  onSubmit,
}: {
  status: HospitalSearchStatus;
  setStatus: (status: HospitalSearchStatus) => void;
  onSubmit: () => void;
}) {
  const setSeverity = (symptom: SymptomId, value: number) => {
    setStatus({
      ...status,
      severities: { ...status.severities, [symptom]: value },
    });
  };
  const selectedSymptoms = symptomOrder.filter((symptom) => status.severities[symptom] > 0);
  const clearSymptoms = () => {
    setStatus({ ...status, severities: initialHospitalStatus.severities });
  };

  return (
    <section className="space-y-4">
      <div className="surface border-2 border-river">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-river">
            <Hospital size={38} aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-black text-river">큰 안내</p>
            <h2 className="text-3xl font-black leading-10">자가 진단</h2>
          </div>
        </div>
        <p className="mt-4 text-xl font-bold leading-9 text-stone-700">
          지금 느끼는 증상을 고르면 가까운 병원 후보를 보여드립니다.
        </p>
      </div>

      {status.emergencyFromShelter && (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-5">
          <div className="flex items-center gap-4">
            <Siren className="text-alert" size={42} aria-hidden="true" />
            <div>
              <h3 className="text-2xl font-black text-alert">응급 위험 신호가 체크되었습니다</h3>
              <p className="mt-2 text-lg font-bold leading-8 text-alert">
                119 상담을 먼저 권장합니다. 병원 후보도 함께 확인할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="secondary-button mt-4 min-h-16 w-full text-lg"
            onClick={() => setStatus({ ...status, emergencyFromShelter: false })}
          >
            응급 체크 해제
          </button>
        </div>
      )}

      <div className="surface">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">증상이 있나요?</h3>
            <p className="mt-2 text-lg font-bold leading-8 text-stone-700">
              있는 증상만 눌러주세요. 누르면 정도 선택이 나옵니다.
            </p>
          </div>
          {selectedSymptoms.length > 0 && (
            <button type="button" className="secondary-button shrink-0" onClick={clearSymptoms}>
              모두 해제
            </button>
          )}
        </div>

        <div className="mt-5 space-y-5">
          {symptomGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-3 flex items-center gap-3">
                <div className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg", group.emergency ? "bg-rose-100 text-alert" : "bg-blue-50 text-river")}>
                  {group.emergency ? <Siren size={28} aria-hidden="true" /> : <HeartPulse size={28} aria-hidden="true" />}
                </div>
                <div>
                  <h4 className={clsx("text-xl font-black", group.emergency ? "text-alert" : "text-river")}>
                    {group.title}
                  </h4>
                  <p className="text-base font-bold leading-7 text-stone-600">{group.description}</p>
                </div>
              </div>
              <div className="grid gap-3">
                {group.symptoms.map((symptom) => (
                  <EasySymptomToggleCard
                    key={symptom}
                    symptom={symptom}
                    selected={status.severities[symptom] > 0}
                    emergency={group.emergency}
                    onToggle={() => setSeverity(symptom, status.severities[symptom] > 0 ? 0 : 1)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedSymptoms.length > 0 && (
        <div className="surface border-2 border-river">
          <h3 className="text-2xl font-black">증상 정도를 골라주세요</h3>
          <p className="mt-2 text-lg font-bold leading-8 text-stone-700">
            1은 약함, 5는 강함입니다.
          </p>
          <div className="mt-4 space-y-4">
            {selectedSymptoms.map((symptom) => (
              <EasySymptomSeverityControl
                key={symptom}
                symptom={symptom}
                value={status.severities[symptom]}
                onChange={(value) => setSeverity(symptom, value)}
                onClear={() => setSeverity(symptom, 0)}
              />
            ))}
          </div>
        </div>
      )}

      <button type="button" className="primary-button min-h-20 w-full text-xl" onClick={onSubmit}>
        <Check size={28} aria-hidden="true" />
        자가 진단 보기
      </button>
    </section>
  );
}

function IntegrationStatusView({
  weatherResult,
  shelterDataset,
  hospitalDataset,
}: {
  weatherResult: WeatherLoadResult;
  shelterDataset: ReturnType<typeof getSheltersWithFallback>;
  hospitalDataset: ReturnType<typeof getHospitalsWithFallback>;
}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "미설정";
  const kakaoMapReady = Boolean(import.meta.env.VITE_KAKAO_MAP_KEY);
  const weatherStatus = weatherResult.source === "api" && weatherResult.ok ? "연결됨" : "fallback";
  const weatherTone = weatherStatus === "연결됨" ? "ok" : "warn";
  const shelterTone = shelterDataset.source === "mock" ? "warn" : "ok";
  const hospitalTone = hospitalDataset.source === "csv" ? "ok" : "warn";

  return (
    <section className="space-y-4">
      <section className="surface">
        <p className="text-sm font-black text-cool">점검 화면</p>
        <h2 className="mt-2 text-2xl font-black text-ink">연동 상태</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          발표 전에 실제 API와 fallback이 어떻게 동작하는지 확인하는 화면입니다.
        </p>
      </section>

      <div className="grid gap-3">
        <StatusCard
          icon={ThermometerSun}
          title="기상청 날씨 API"
          status={weatherStatus}
          tone={weatherTone}
          detail={weatherResult.message}
          meta={weatherResult.source === "api" ? weatherResult.data.updatedAt : "mockData 사용"}
        />
        <StatusCard
          icon={Hospital}
          title="화성시 의료기관 데이터"
          status={hospitalDataset.source === "csv" ? "CSV 반영" : "mockData"}
          tone={hospitalTone}
          detail={hospitalDataset.message}
          meta={hospitalDataset.data.length + "개 기관 로드"}
        />
        <StatusCard
          icon={Home}
          title="무더위쉼터 데이터"
          status={shelterDataset.source === "mock" ? "mockData" : "연결됨"}
          tone={shelterTone}
          detail={shelterDataset.message}
          meta={shelterDataset.data.length + "개 쉼터 로드"}
        />
        <StatusCard
          icon={Navigation}
          title="지도 기능"
          status={kakaoMapReady ? "주소 좌표 변환" : "외부 링크"}
          tone="info"
          detail={kakaoMapReady ? "카카오 지도 키로 주소와 GPS 좌표를 보정합니다. 실패하면 기존 fallback을 사용합니다." : "지도 SDK 없이 카카오맵 검색 링크로 길찾기를 연결합니다."}
          meta={kakaoMapReady ? "키 값은 화면에 표시하지 않음" : "지도 API 키 불필요"}
        />
      </div>

      <section className="surface">
        <h3 className="text-lg font-black">실행 주소</h3>
        <div className="mt-3 space-y-2 text-sm font-bold text-stone-700">
          <p>프론트엔드: http://127.0.0.1:5173</p>
          <p>백엔드: {apiBaseUrl}</p>
          <p>백엔드 상태 확인: {apiBaseUrl === "미설정" ? "VITE_API_BASE_URL 필요" : apiBaseUrl + "/api/health"}</p>
        </div>
      </section>

      <section className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm font-bold leading-6 text-stone-700">
        <p>
          무더위쉼터 API 승인 전에는 쉼터 데이터가 mockData로 표시됩니다. 이 상태는 발표 안정성을 위한 정상 fallback입니다.
        </p>
      </section>
    </section>
  );
}

function StatusCard({
  icon: Icon,
  title,
  status,
  tone,
  detail,
  meta,
}: {
  icon: LucideIcon;
  title: string;
  status: string;
  tone: "ok" | "warn" | "info";
  detail: string;
  meta: string;
}) {
  return (
    <article className="surface">
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "rounded-lg p-3",
            tone === "ok" && "bg-emerald-50 text-emerald-700",
            tone === "warn" && "bg-orange-50 text-cool",
            tone === "info" && "bg-blue-50 text-river",
          )}
        >
          <Icon size={24} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black">{title}</h3>
            <StatusBadge tone={tone}>{status}</StatusBadge>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-stone-700">{detail}</p>
          <p className="mt-2 text-xs font-black text-stone-500">{meta}</p>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: "ok" | "warn" | "info" }) {
  return (
    <span
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-black",
        tone === "ok" && "bg-emerald-100 text-emerald-800",
        tone === "warn" && "bg-orange-100 text-cool",
        tone === "info" && "bg-blue-100 text-river",
      )}
    >
      {children}
    </span>
  );
}

function ShelterResultView({
  risk,
  recommendations,
  weather,
  onEdit,
}: {
  risk: ReturnType<typeof classifyRisk>;
  recommendations: ShelterRecommendation[];
  weather: WeatherLoadResult;
  onEdit: () => void;
}) {
  return (
    <section className="space-y-4">
      <ResultHeader title="쉼터 추천 결과" onEdit={onEdit} />
      <WeatherStrip result={weather} />
      <RiskPanel risk={risk} showSignals={false} />
      <div className="space-y-3">
        {recommendations.map((recommendation, index) => (
          <ShelterCard key={recommendation.shelter.id} recommendation={recommendation} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function HospitalResultView({
  risk,
  hospitals,
  weather,
  onEdit,
}: {
  risk: ReturnType<typeof classifyHospitalRisk>;
  hospitals: ReturnType<typeof recommendHospitals>;
  weather: WeatherLoadResult;
  onEdit: () => void;
}) {
  return (
    <section className="space-y-4">
      <ResultHeader title="자가 진단 결과" onEdit={onEdit} />
      <WeatherStrip result={weather} />
      <RiskPanel risk={risk} />
      {risk.level === "emergency" && (
        <a href="tel:119" className="danger-button w-full">
          <Siren size={18} aria-hidden="true" />
          119 전화
        </a>
      )}
      <div className="space-y-3">
        {hospitals.map((item) => (
          <HospitalCard key={item.hospital.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function EasyShelterResultView({
  risk,
  recommendations,
  onEdit,
  onOpenHospital,
}: {
  risk: ReturnType<typeof classifyRisk>;
  recommendations: ShelterRecommendation[];
  onEdit: () => void;
  onOpenHospital: () => void;
}) {
  const first = recommendations[0];
  const RiskIcon = risk.level === "emergency" ? Siren : risk.level === "caution" ? AlertTriangle : ShieldCheck;

  return (
    <section className="space-y-4">
      <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onEdit}>
        <ArrowLeft size={24} aria-hidden="true" />
        다시 입력하기
      </button>

      <div className={clsx("surface", risk.level === "emergency" && "border-rose-300 bg-rose-50")}>
        <div className="flex items-center gap-4">
          <div className={clsx("rounded-lg p-4", risk.level === "emergency" ? "bg-rose-100 text-alert" : "bg-orange-50 text-cool")}>
            <RiskIcon size={46} aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-black text-cool">지금 할 일</p>
            <h2 className="mt-1 text-3xl font-black leading-9">{risk.title}</h2>
          </div>
        </div>
        <p className="mt-4 text-xl font-bold leading-9 text-stone-700">{risk.guidance}</p>
      </div>

      {risk.level === "emergency" && (
        <a href="tel:119" className="danger-button min-h-16 w-full text-lg">
          <Siren size={24} aria-hidden="true" />
          119 전화
        </a>
      )}

      {first ? (
        <article className="rounded-lg border-2 border-cool bg-white p-5 shadow-soft">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-cool">
              <Home size={38} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black text-cool">가장 먼저 갈 쉼터</p>
              <h3 className="mt-2 text-3xl font-black leading-10">{first.shelter.name}</h3>
              <p className="mt-3 text-xl font-bold leading-8 text-stone-700">{formatDistance(first.distanceKm)} 거리입니다.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-lg">
            <Metric label="냉방기" value={first.shelter.airConditioners + "대"} />
            <Metric label="수용가능" value={first.shelter.capacity + "명"} />
            <Metric label="가까운 병원" value={formatDistance(first.nearestHospitalDistanceKm)} />
            <Metric label="추천 유형" value={first.title} />
          </div>
          <div className="mt-5 grid gap-3">
            <a href={kakaoSearchUrl(first.shelter.name)} target="_blank" rel="noreferrer" className="primary-button min-h-16 w-full text-lg">
              <Navigation size={24} aria-hidden="true" />
              길찾기
            </a>
            <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onOpenHospital}>
              <Hospital size={24} aria-hidden="true" />
              자가 진단 보기
            </button>
          </div>
        </article>
      ) : (
        <EmptyResult icon={Home} title="추천 쉼터 없음" body="표시할 쉼터 데이터가 없습니다." />
      )}

      {recommendations.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-xl font-black">다른 쉼터</h3>
          {recommendations.slice(1).map((item) => (
            <article key={item.shelter.id} className="rounded-lg border border-line bg-white p-4">
              <p className="text-base font-black text-cool">{item.title}</p>
              <h4 className="mt-1 text-xl font-black leading-7">{item.shelter.name}</h4>
              <p className="mt-2 text-lg font-bold text-stone-600">{formatDistance(item.distanceKm)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EasyHospitalResultView({
  risk,
  hospitals,
  onEdit,
}: {
  risk: ReturnType<typeof classifyHospitalRisk>;
  hospitals: ReturnType<typeof recommendHospitals>;
  onEdit: () => void;
}) {
  const first = hospitals[0];
  const RiskIcon = risk.level === "emergency" ? Siren : risk.level === "caution" ? AlertTriangle : ShieldCheck;

  return (
    <section className="space-y-4">
      <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onEdit}>
        <ArrowLeft size={24} aria-hidden="true" />
        다시 입력하기
      </button>

      <div className={clsx("surface", risk.level === "emergency" && "border-rose-300 bg-rose-50")}>
        <div className="flex items-center gap-4">
          <div className={clsx("rounded-lg p-4", risk.level === "emergency" ? "bg-rose-100 text-alert" : "bg-blue-50 text-river")}>
            <RiskIcon size={46} aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-black text-river">자가 진단 결과</p>
            <h2 className="mt-1 text-3xl font-black leading-9">{risk.title}</h2>
          </div>
        </div>
        <p className="mt-4 text-xl font-bold leading-9 text-stone-700">{risk.guidance}</p>
      </div>

      {risk.level === "emergency" && (
        <a href="tel:119" className="danger-button min-h-16 w-full text-lg">
          <Siren size={24} aria-hidden="true" />
          119 전화
        </a>
      )}

      {first ? (
        <article className="rounded-lg border-2 border-river bg-white p-5 shadow-soft">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-river">
              <Hospital size={38} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black text-river">먼저 전화할 곳</p>
              <h3 className="mt-2 text-3xl font-black leading-10">{first.hospital.name}</h3>
              <p className="mt-3 text-xl font-bold leading-8 text-stone-700">{formatDistance(first.distanceKm)} · {first.hospital.phone}</p>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-paper p-3 text-lg font-bold leading-8 text-stone-700">{first.hospital.departments}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a href={"tel:" + first.hospital.phone} className="secondary-button min-h-16 text-lg">
              <Phone size={24} aria-hidden="true" />
              전화
            </a>
            <a href={kakaoSearchUrl(first.hospital.name)} target="_blank" rel="noreferrer" className="primary-button min-h-16 text-lg">
              <Navigation size={24} aria-hidden="true" />
              길찾기
            </a>
          </div>
        </article>
      ) : (
        <EmptyResult icon={Hospital} title="추천 병원 없음" body="표시할 의료기관 데이터가 없습니다." />
      )}

      {hospitals.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-xl font-black">다른 병원</h3>
          {hospitals.slice(1).map((item) => (
            <article key={item.hospital.id} className="rounded-lg border border-line bg-white p-4">
              <h4 className="text-xl font-black leading-7">{item.hospital.name}</h4>
              <p className="mt-2 text-lg font-bold text-stone-600">{formatDistance(item.distanceKm)} · {item.hospital.phone}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ResultHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="surface">
      <button type="button" className="secondary-button mb-3" onClick={onEdit}>
        <ArrowLeft size={18} aria-hidden="true" />
        제출 정보 수정
      </button>
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        제출한 정보를 기준으로 추천을 계산했습니다.
      </p>
    </div>
  );
}

function EmptyResult({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="surface text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-paper text-cool">
        <Icon size={30} aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">{body}</p>
    </div>
  );
}

function EasyModeView({
  risk,
  shelter,
  hospital,
  onBasicMode,
  onOpenShelter,
  onOpenHospital,
}: {
  risk: RiskResult;
  shelter?: ShelterRecommendation;
  hospital?: ReturnType<typeof recommendHospitals>[number];
  onBasicMode: () => void;
  onOpenShelter: () => void;
  onOpenHospital: () => void;
}) {
  const RiskIcon = risk.level === "emergency" ? Siren : risk.level === "caution" ? AlertTriangle : ShieldCheck;

  return (
    <section className="space-y-4">
      <div className={clsx("surface", risk.level === "emergency" && "border-rose-300 bg-rose-50")}> 
        <div className="flex items-center gap-4">
          <div className={clsx("rounded-lg p-4", risk.level === "emergency" ? "bg-rose-100 text-alert" : "bg-orange-50 text-cool")}>
            <RiskIcon size={42} aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-black text-cool">지금 안내</p>
            <h2 className="mt-1 text-2xl font-black leading-8">{risk.title}</h2>
          </div>
        </div>
        <p className="mt-4 text-lg font-bold leading-8 text-stone-700">{risk.guidance}</p>
      </div>

      <div className="grid gap-3">
        <button type="button" className="easy-action" onClick={onOpenShelter}>
          <Home size={38} aria-hidden="true" />
          <span>
            <strong>쉼터 찾기</strong>
            <small>시원한 곳으로 이동</small>
          </span>
        </button>
        <button type="button" className="easy-action" onClick={onOpenHospital}>
          <Hospital size={38} aria-hidden="true" />
          <span>
            <strong>자가 진단</strong>
            <small>병원 후보 확인</small>
          </span>
        </button>
        <a href="tel:119" className="easy-action easy-danger">
          <Siren size={38} aria-hidden="true" />
          <span>
            <strong>119 전화</strong>
            <small>응급 상담 권장</small>
          </span>
        </a>
      </div>

      {shelter && (
        <article className="rounded-lg border-2 border-cool bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 text-cool" size={32} aria-hidden="true" />
            <div>
              <p className="text-base font-black text-cool">가장 먼저 볼 쉼터</p>
              <h3 className="mt-2 text-2xl font-black leading-8">{shelter.shelter.name}</h3>
              <p className="mt-2 text-lg leading-8 text-stone-700">
                {formatDistance(shelter.distanceKm)} 거리입니다.
              </p>
            </div>
          </div>
        </article>
      )}

      {hospital && (
        <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <Phone className="mt-1 text-river" size={32} aria-hidden="true" />
            <div>
              <p className="text-base font-black text-river">가까운 병원</p>
              <h3 className="mt-2 text-2xl font-black leading-8">{hospital.hospital.name}</h3>
              <p className="mt-2 text-lg leading-8 text-stone-700">
                {formatDistance(hospital.distanceKm)} · {hospital.hospital.phone}
              </p>
            </div>
          </div>
        </article>
      )}

      <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onBasicMode}>
        <UserRound size={24} aria-hidden="true" />
        기본 모드로 보기
      </button>
    </section>
  );
}

function EasyChoiceCard({
  selected,
  icon: Icon,
  title,
  description,
  danger = false,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "flex min-h-24 items-center gap-4 rounded-lg border-2 bg-white p-4 text-left transition",
        selected && danger && "border-alert bg-rose-50 text-alert",
        selected && !danger && "border-cool bg-orange-50 text-cool",
        !selected && "border-line text-ink hover:border-cool",
      )}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={clsx("flex h-14 w-14 shrink-0 items-center justify-center rounded-lg", danger ? "bg-rose-100 text-alert" : "bg-orange-50 text-cool")}>
        <Icon size={34} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-2xl font-black leading-8">{title}</strong>
        <small className="mt-1 block text-lg font-bold leading-7 text-stone-600">{description}</small>
      </span>
      {selected && <Check size={26} aria-hidden="true" />}
    </button>
  );
}

function EasyDurationPicker({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const durationStep = durationStepFromMinutes(minutes);
  const changeBy = (delta: number) => {
    onChange(durationMinutesFromStep(durationStep + delta));
  };

  return (
    <div className="surface">
      <h3 className="text-2xl font-black">밖에 얼마나 있었나요?</h3>
      <div className="mt-4 rounded-lg bg-orange-50 p-4 text-center">
        <p className="text-4xl font-black leading-none text-cool">{durationLabel(minutes)}</p>
        <p className="mt-2 text-lg font-bold text-stone-700">30분 단위로 선택합니다</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          className="secondary-button min-h-16 text-lg"
          disabled={durationStep <= 0}
          onClick={() => changeBy(-1)}
        >
          - 30분
        </button>
        <button
          type="button"
          className="secondary-button min-h-16 text-lg"
          disabled={durationStep >= durationMaxStep}
          onClick={() => changeBy(1)}
        >
          + 30분
        </button>
      </div>
      <input
        type="range"
        min="0"
        max={durationMaxStep}
        step="1"
        value={durationStep}
        onChange={(event) => onChange(durationMinutesFromStep(Number(event.target.value)))}
        className="mt-5 w-full accent-cool"
        aria-label="바깥 활동 시간"
      />
      <div className="mt-2 flex items-center justify-between text-sm font-black text-stone-500">
        <span>0분</span>
        <span>5시간</span>
        <span>10시간 이상</span>
      </div>
    </div>
  );
}

function EasyLocationSelector({
  mode,
  display,
  note,
  selectedAddressLabel,
  onUseGps,
  onUseActivityArea,
  onUseAddress,
}: {
  mode: LocationMode;
  display: string;
  note: string;
  selectedAddressLabel: string;
  onUseGps: () => void;
  onUseActivityArea: () => void;
  onUseAddress: (address: AddressCandidate) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="surface">
      <h3 className="text-2xl font-black">위치 기준</h3>
      <p className="mt-2 text-lg font-bold leading-8 text-stone-700">
        어디를 기준으로 쉼터를 찾을지 고르세요.
      </p>
      <div className="mt-4 grid gap-3">
        <EasyChoiceCard
          selected={mode === "gps"}
          icon={LocateFixed}
          title="GPS 현재 위치"
          description="휴대폰 위치 기준"
          onClick={onUseGps}
        />
        <EasyChoiceCard
          selected={mode === "area"}
          icon={MapPin}
          title="활동 지역 중심"
          description="계정 정보의 지역 기준"
          onClick={onUseActivityArea}
        />
        <EasyChoiceCard
          selected={mode === "address"}
          icon={Search}
          title="주소 검색"
          description="실제 주소 검색"
          onClick={() => setSearchOpen(true)}
        />
      </div>

      <div className="mt-4 rounded-lg bg-white px-4 py-4 text-ink shadow-sm">
        <p className="text-base font-black text-stone-500">선택된 위치</p>
        <p className="mt-1 text-2xl font-black leading-9">{display}</p>
      </div>
      {note && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-base font-bold leading-7 text-cool">
          <span className="mr-1 text-alert">*</span>
          {note}
        </div>
      )}

      {searchOpen && (
        <AddressSearchDialog
          onSelect={(address) => {
            onUseAddress(address);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

function LocationSelector({
  mode,
  display,
  note,
  selectedAddressLabel,
  onUseGps,
  onUseActivityArea,
  onUseAddress,
}: {
  mode: LocationMode;
  display: string;
  note: string;
  selectedAddressLabel: string;
  onUseGps: () => void;
  onUseActivityArea: () => void;
  onUseAddress: (address: AddressCandidate) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <FieldGroup label="위치 기준">
      <div className="control-panel">
        <div className="grid gap-2">
          <LocationModeButton
            selected={mode === "gps"}
            icon={LocateFixed}
            title="GPS 현재 위치"
            description="브라우저 위치 권한으로 계산"
            onClick={onUseGps}
          />
          <LocationModeButton
            selected={mode === "area"}
            icon={MapPin}
            title="활동 지역 중심"
            description="계정 정보의 구/행정구 기준"
            onClick={onUseActivityArea}
          />
          <LocationModeButton
            selected={mode === "address"}
            icon={Search}
            title="주소 검색"
            description="실제 주소 검색"
            onClick={() => setSearchOpen(true)}
          />
        </div>
        <div className="mt-3 rounded-lg bg-white px-3 py-3 text-base font-black leading-6 text-ink">
          {display}
        </div>
        {note && (
          <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold leading-5 text-cool">
            <span className="mr-1 text-alert">*</span>
            {note}
          </div>
        )}
      </div>

      {searchOpen && (
        <AddressSearchDialog
          onSelect={(address) => {
            onUseAddress(address);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </FieldGroup>
  );
}

function LocationModeButton({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "flex min-h-16 items-center gap-3 rounded-lg border bg-white px-3 py-3 text-left transition hover:border-cool",
        selected ? "border-cool bg-orange-50 text-cool" : "border-line text-ink",
      )}
      onClick={onClick}
    >
      <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", selected ? "bg-orange-100 text-cool" : "bg-paper text-stone-600")}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-black">{title}</strong>
        <small className="mt-1 block text-xs font-bold leading-5 text-stone-500">{description}</small>
      </span>
      {selected && <Check size={18} aria-hidden="true" />}
    </button>
  );
}

function AddressSearchDialog({
  onSelect,
  onClose,
}: {
  onSelect: (address: AddressCandidate) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<"idle" | "loading" | "fallback">("idle");
  const [searchMessage, setSearchMessage] = useState("카카오/다음 주소검색으로 실제 주소를 찾을 수 있습니다.");
  const normalizedQuery = query.trim().toLowerCase();
  const results = mockAddressCandidates.filter((candidate) => {
    if (!normalizedQuery) {
      return true;
    }

    return (
      candidate.label.toLowerCase().includes(normalizedQuery) ||
      candidate.address.toLowerCase().includes(normalizedQuery)
    );
  });

  const openRealAddressSearch = async () => {
    setSearchState("loading");
    setSearchMessage("주소 검색 창을 여는 중입니다.");

    try {
      const Postcode = await loadDaumPostcode();
      new Postcode({
        oncomplete: async (data: DaumPostcodeData) => {
          onSelect(await addressCandidateFromPostcode(data));
        },
      }).open();
      setSearchState("idle");
      setSearchMessage("주소 검색 창에서 주소를 선택해 주세요.");
    } catch {
      setSearchState("fallback");
      setSearchMessage("주소 검색을 불러오지 못했습니다. 아래 빠른 선택 주소를 사용할 수 있습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-4 pb-4 pt-12" role="dialog" aria-modal="true" aria-labelledby="address-search-title">
      <div className="relative w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <DialogCloseButton onClick={onClose} label="주소 검색 닫기" />
        <div className="pr-10">
          <p className="text-sm font-bold text-cool">실제 주소 검색</p>
          <h2 id="address-search-title" className="mt-1 text-xl font-black">주소를 검색하세요</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            주소 검색은 실제 주소 검색 창을 사용합니다. 지도 키가 설정되어 있으면 실제 좌표로 추천을 계산합니다.
          </p>
        </div>

        <button
          type="button"
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-cool px-4 text-base font-black text-white shadow-soft transition hover:bg-coolDark"
          onClick={openRealAddressSearch}
          disabled={searchState === "loading"}
        >
          <Search size={20} aria-hidden="true" />
          {searchState === "loading" ? "주소 검색 여는 중" : "주소 검색 창 열기"}
        </button>

        <p className={clsx("mt-3 rounded-lg px-3 py-2 text-xs font-bold leading-5", searchState === "fallback" ? "border border-orange-200 bg-orange-50 text-cool" : "bg-paper text-stone-600")}>
          {searchState === "fallback" && <span className="mr-1 text-alert">*</span>}
          {searchMessage}
        </p>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-black text-stone-700">빠른 선택 주소 검색</span>
          <div className="relative">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예: 화성시청, 동탄역, 남양읍"
              className="min-h-12 w-full rounded-lg border border-line px-3 pl-10 text-base"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={19} aria-hidden="true" />
          </div>
        </label>

        <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
          {results.length > 0 ? (
            results.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="w-full rounded-lg border border-line bg-white p-3 text-left transition hover:border-cool hover:bg-orange-50"
                onClick={() => onSelect(candidate)}
              >
                <strong className="block text-sm font-black text-ink">{candidate.label}</strong>
                <span className="mt-1 block text-xs font-bold leading-5 text-stone-600">{candidate.address}</span>
              </button>
            ))
          ) : (
            <p className="rounded-lg bg-paper p-3 text-sm font-bold leading-6 text-stone-600">
              빠른 선택 결과가 없습니다. 위의 주소 검색 창을 열어 실제 주소를 검색해 주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WeatherStrip({ result }: { result: WeatherLoadResult }) {
  const weather = result.data;
  const sourceLabel = result.source === "api" ? "기상청 API 반영" : "mockData 사용";

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-line bg-white p-3">
          <ThermometerSun className="text-heat" size={20} aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-stone-500">기온</p>
          <p className="font-black">{weather.temperatureC}도</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-3">
          <Wind className="text-river" size={20} aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-stone-500">습도</p>
          <p className="font-black">{weather.humidityPercent}%</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-3">
          <Activity className="text-alert" size={20} aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-stone-500">폭염 위험</p>
          <p className="font-black">{weather.heatRisk}</p>
        </div>
      </div>
      <p className="mt-2 text-xs font-bold text-stone-500">
        {sourceLabel} · {weather.updatedAt}
      </p>
    </div>
  );
}

function RiskPanel({ risk, showSignals = true }: { risk: RiskResult; showSignals?: boolean }) {
  return (
    <div
      className={clsx(
        "surface",
        risk.level === "emergency" && "border-rose-300 bg-rose-50",
        risk.level === "caution" && "border-orange-200 bg-orange-50",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={risk.level === "emergency" ? "text-alert" : "text-heat"}
          size={24}
          aria-hidden="true"
        />
        <div>
          <h3 className="text-lg font-black">{risk.title}</h3>
          <p className="mt-1 text-sm leading-6 text-stone-700">{risk.guidance}</p>
        </div>
      </div>
      {showSignals && risk.signals.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {risk.signals.map((signal) => (
            <span key={signal} className="tag">
              {signal}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ShelterCard({
  recommendation,
  rank,
}: {
  recommendation: ShelterRecommendation;
  rank: number;
}) {
  const { shelter } = recommendation;

  return (
    <article className="surface">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cool font-black text-white">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-cool">{recommendation.title}</p>
          <h3 className="mt-1 text-lg font-black leading-6">{shelter.name}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">{shelter.address}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-line py-3 text-sm">
        <Metric label="거리" value={formatDistance(recommendation.distanceKm)} />
        <Metric label="가까운 병원" value={formatDistance(recommendation.nearestHospitalDistanceKm)} />
        <Metric label="냉방기" value={shelter.airConditioners + "대"} />
        <Metric label="수용가능" value={shelter.capacity + "명"} />
      </div>

      <a
        href={kakaoSearchUrl(shelter.name)}
        target="_blank"
        rel="noreferrer"
        className="primary-button mt-4 w-full"
      >
        <Navigation size={18} aria-hidden="true" />
        길찾기 검색
      </a>
    </article>
  );
}

function HospitalCard({ item }: { item: ReturnType<typeof recommendHospitals>[number] }) {
  return (
    <article className="surface">
      <div className="flex items-start gap-3">
        <HeartPulse className="mt-1 text-river" size={24} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black">{item.hospital.name}</h3>
          <p className="mt-1 text-sm text-stone-600">
            {item.hospital.type} · {formatDistance(item.distanceKm)}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{item.hospital.departments}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.reasons.map((reason) => (
          <span key={reason} className="tag">
            {reason}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={"tel:" + item.hospital.phone} className="secondary-button">
          <Phone size={18} aria-hidden="true" />
          전화
        </a>
        <a
          href={kakaoSearchUrl(item.hospital.name)}
          target="_blank"
          rel="noreferrer"
          className="primary-button"
        >
          <Navigation size={18} aria-hidden="true" />
          길찾기
        </a>
      </div>
    </article>
  );
}

function BasicModeDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4" role="dialog" aria-modal="true" aria-labelledby="basic-dialog-title">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
        <DialogCloseButton onClick={onClose} label="기본 모드 팝업 닫기" />
        <div className="flex items-start gap-4 pr-10">
          <div className="rounded-lg bg-paper p-4 text-ink">
            <UserRound size={42} aria-hidden="true" />
          </div>
          <div>
            <h2 id="basic-dialog-title" className="text-2xl font-black leading-8">
              기본 모드로 볼까요?
            </h2>
            <p className="mt-3 text-lg font-bold leading-8 text-stone-700">
              메뉴와 글씨 크기가 일반 화면으로 돌아갑니다.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <button type="button" className="primary-button min-h-16 w-full text-lg" onClick={onConfirm}>
            <UserRound size={24} aria-hidden="true" />
            기본 모드로 보기
          </button>
          <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onClose}>
            쉬운 모드 계속 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function EasyEnableDialog({
  onEnable,
  onClose,
}: {
  onEnable: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4" role="dialog" aria-modal="true" aria-labelledby="easy-dialog-title">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
        <DialogCloseButton onClick={onClose} label="쉬운 안내 팝업 닫기" />
        <div className="flex items-start gap-4 pr-10">
          <div className="rounded-lg bg-orange-50 p-4 text-cool">
            <ShieldCheck size={42} aria-hidden="true" />
          </div>
          <div>
            <h2 id="easy-dialog-title" className="text-2xl font-black leading-8">
              쉬운 안내를 켤까요?
            </h2>
            <p className="mt-3 text-lg font-bold leading-8 text-stone-700">
              큰 글씨와 큰 아이콘으로 쉼터, 자가 진단, 119 버튼을 먼저 보여줍니다.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <button type="button" className="primary-button min-h-16 w-full text-lg" onClick={onEnable}>
            <ShieldCheck size={24} aria-hidden="true" />
            쉬운 안내 켜기
          </button>
          <button type="button" className="secondary-button min-h-16 w-full text-lg" onClick={onClose}>
            기본 모드로 계속 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function EmergencyDialog({
  onGoHospital,
  onStayShelter,
  onClose,
}: {
  onGoHospital: () => void;
  onStayShelter: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-4 pb-4 pt-12" role="dialog" aria-modal="true" aria-labelledby="emergency-dialog-title">
      <div className="relative w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <DialogCloseButton onClick={onClose} label="응급 안내 팝업 닫기" />
        <div className="flex items-start gap-3 pr-10">
          <div className="rounded-lg bg-rose-100 p-3 text-alert">
            <Siren size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 id="emergency-dialog-title" className="text-xl font-black">
              자가 진단으로 이동할까요?
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              쉼터 찾기에서 응급 위험 신호가 체크되었습니다. 119 상담 또는 병원 후보 확인을 먼저 권장합니다.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-2">
          <button type="button" className="danger-button w-full" onClick={onGoHospital}>
            <Hospital size={18} aria-hidden="true" />
            자가 진단으로 이동
          </button>
          <button type="button" className="secondary-button w-full" onClick={onStayShelter}>
            쉼터 계속 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm font-black text-stone-700">
        <span>
          {label} {required && <RequiredMark />}
        </span>
        {help && <InfoTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

function RequiredMark() {
  return <span className="text-alert">*</span>;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-stone-600 hover:border-cool hover:text-cool"
        aria-label="설명 보기"
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>
      <span className="pointer-events-none absolute bottom-8 right-0 z-30 hidden w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-line bg-white p-3 text-left text-xs font-bold leading-5 text-stone-700 shadow-soft group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

function TransportGrid({
  selected,
  onSelect,
}: {
  selected: TransportMode | "";
  onSelect: (value: TransportMode) => void;
}) {
  const options: Array<{ value: TransportMode; label: string; icon: LucideIcon }> = [
    { value: "walk", label: "도보", icon: Footprints },
    { value: "bus", label: "버스", icon: Bus },
    { value: "car", label: "자가용", icon: Car },
    { value: "caregiver", label: "보호자 동행", icon: UsersRound },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            className={clsx("option-button", selected === option.value && "option-button-selected")}
            onClick={() => onSelect(option.value)}
          >
            <span className="flex items-center gap-2">
              <Icon size={18} aria-hidden="true" />
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HelpOptionButton({
  selected,
  label,
  help,
  onClick,
}: {
  selected: boolean;
  label: string;
  help: string;
  onClick: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className={clsx("option-button w-full pr-11", selected && "option-button-selected")}
        onClick={onClick}
      >
        <span className="flex items-center gap-2">
          {selected && <Check size={18} aria-hidden="true" />}
          {label}
        </span>
      </button>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <InfoTooltip text={help} />
      </div>
    </div>
  );
}

function BooleanButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx("option-button", selected && "option-button-selected")}
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-2">
        {label}
        {selected && <Check size={18} aria-hidden="true" />}
      </span>
    </button>
  );
}

function YesNoControl({
  value,
  yesLabel,
  noLabel,
  danger,
  onChange,
}: {
  value: boolean;
  yesLabel: string;
  noLabel: string;
  danger?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className={clsx(
          "option-button text-center",
          value && (danger ? "border-alert bg-rose-50 text-alert" : "option-button-selected"),
        )}
        onClick={() => onChange(true)}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        className={clsx("option-button text-center", !value && "option-button-selected")}
        onClick={() => onChange(false)}
      >
        {noLabel}
      </button>
    </div>
  );
}

function DialogCloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-stone-500 transition hover:border-cool hover:text-cool"
      onClick={onClick}
      aria-label={label}
    >
      <X size={20} aria-hidden="true" />
    </button>
  );
}

function EasySymptomToggleCard({
  symptom,
  selected,
  emergency,
  onToggle,
}: {
  symptom: SymptomId;
  selected: boolean;
  emergency: boolean;
  onToggle: () => void;
}) {
  const visual = symptomVisuals[symptom];
  const Icon = visual.icon;

  return (
    <button
      type="button"
      className={clsx(
        "flex min-h-24 items-center gap-4 rounded-lg border-2 bg-white p-4 text-left transition",
        selected && emergency && "border-alert bg-rose-50 text-alert",
        selected && !emergency && "border-river bg-blue-50 text-river",
        !selected && "border-line text-ink hover:border-cool",
      )}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className={clsx("flex h-14 w-14 shrink-0 items-center justify-center rounded-lg", emergency ? "bg-rose-100 text-alert" : "bg-blue-50 text-river")}>
        <Icon size={32} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-2xl font-black leading-8">{visual.shortLabel}</strong>
        <small className="mt-1 block text-lg font-bold leading-7 text-stone-600">{visual.hint}</small>
      </span>
      {selected && <Check size={26} aria-hidden="true" />}
    </button>
  );
}

function EasySymptomSeverityControl({
  symptom,
  value,
  onChange,
  onClear,
}: {
  symptom: SymptomId;
  value: number;
  onChange: (value: number) => void;
  onClear: () => void;
}) {
  const visual = symptomVisuals[symptom];

  return (
    <div className="rounded-lg bg-paper p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-2xl font-black leading-8">{visual.shortLabel}</h4>
          <p className="mt-1 text-base font-bold text-stone-600">{visual.hint}</p>
        </div>
        <button type="button" className="secondary-button shrink-0" onClick={onClear}>
          지우기
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={clsx(
              "flex min-h-16 items-center justify-center rounded-lg border-2 text-2xl font-black transition",
              value === score ? "border-river bg-blue-50 text-river" : "border-line bg-white text-ink hover:border-river",
            )}
            onClick={() => onChange(score)}
            aria-pressed={value === score}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-sm font-black text-stone-500">
        <span>약함</span>
        <span>강함</span>
      </div>
    </div>
  );
}

function SymptomToggleCard({
  symptom,
  selected,
  emergency,
  onToggle,
}: {
  symptom: SymptomId;
  selected: boolean;
  emergency: boolean;
  onToggle: () => void;
}) {
  const visual = symptomVisuals[symptom];
  const Icon = visual.icon;

  return (
    <button
      type="button"
      className={clsx(
        "min-h-24 rounded-lg border bg-white p-3 text-left transition",
        selected && emergency && "border-alert bg-rose-50 text-alert",
        selected && !emergency && "border-river bg-blue-50 text-river",
        !selected && "border-line text-ink hover:border-cool",
      )}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={clsx("flex h-9 w-9 items-center justify-center rounded-lg", emergency ? "bg-rose-100 text-alert" : "bg-blue-50 text-river")}>
          <Icon size={21} aria-hidden="true" />
        </span>
        {selected && <Check size={18} aria-hidden="true" />}
      </span>
      <strong className="mt-2 block text-base leading-5">{visual.shortLabel}</strong>
      <small className="mt-1 block text-xs font-bold leading-5 text-stone-500">{visual.hint}</small>
    </button>
  );
}

function SymptomSeverityControl({
  symptom,
  value,
  onChange,
  onClear,
}: {
  symptom: SymptomId;
  value: number;
  onChange: (value: number) => void;
  onClear: () => void;
}) {
  const visual = symptomVisuals[symptom];

  return (
    <div className="rounded-lg bg-paper p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-stone-600">
        <span className="font-black text-ink">{visual.shortLabel}</span>
        <div className="flex items-center gap-2">
          <span>{value}점</span>
          <button type="button" className="rounded-full p-1 text-stone-500 hover:bg-white hover:text-cool" onClick={onClear} aria-label={visual.shortLabel + " 선택 해제"}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-river"
        aria-label={visual.shortLabel + " 강도"}
      />
      <div className="mt-1 flex justify-between text-xs font-bold text-stone-500">
        <span>약함</span>
        <span>3</span>
        <span>강함</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-stone-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

export default App;

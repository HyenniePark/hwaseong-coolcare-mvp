import {
  cautionSymptoms,
  emergencySymptoms,
  mockWeather,
  symptomLabels,
} from "../data/mockData";
import type {
  CoolingShelter,
  CurrentStatus,
  GeoPoint,
  HospitalRecommendation,
  HospitalSearchStatus,
  MedicalFacility,
  RiskResult,
  ShelterRecommendation,
  SymptomId,
  SymptomSeverity,
  UserProfile,
} from "../types";

type WeatherLike = typeof mockWeather;

const toRad = (value: number) => (value * Math.PI) / 180;

export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km: number) {
  if (km < 1) {
    return String(Math.round(km * 1000)) + "m";
  }

  return km.toFixed(1) + "km";
}

export function selectedSymptomsFromSeverity(severities: SymptomSeverity): SymptomId[] {
  return (Object.entries(severities) as Array<[SymptomId, number]>)
    .filter(([, severity]) => severity > 0)
    .map(([symptom]) => symptom);
}

function weatherStressScore(weather: WeatherLike = mockWeather) {
  let score = 0;

  if (weather.temperatureC >= 35) {
    score += 3;
  } else if (weather.temperatureC >= 33) {
    score += 2;
  } else if (weather.temperatureC >= 30) {
    score += 1;
  }

  if (weather.humidityPercent >= 75) {
    score += 2;
  } else if (weather.humidityPercent >= 65) {
    score += 1;
  }

  if (weather.heatRisk === "높음") {
    score += 2;
  }

  return score;
}

function profileVulnerabilityScore(profile: UserProfile, status: CurrentStatus) {
  let score = 0;

  if (profile.age >= 75) {
    score += 3;
  } else if (profile.age >= 65) {
    score += 2;
  }

  if (profile.hasChronicDisease) {
    score += 2;
  }

  if (!profile.hasAirConditioner) {
    score += 1.5;
  }

  if (profile.transport === "walk") {
    score += 1.5;
  }

  if (profile.traits.includes("outdoorWorker")) {
    score += 2;
  }

  if (profile.traits.includes("limitedMobility")) {
    score += 1;
  }

  if (status.symptoms.length > 0) {
    score += 2;
  }

  return score;
}

function movementPenaltyFactor(profile: UserProfile) {
  if (profile.transport === "walk") {
    return 22;
  }

  if (profile.age >= 65 || profile.traits.includes("limitedMobility")) {
    return 16;
  }

  if (profile.transport === "bus") {
    return 12;
  }

  return 9;
}

function medicalNeedFactor(profile: UserProfile, status: CurrentStatus) {
  let factor = 1;

  if (profile.hasChronicDisease) {
    factor += 0.5;
  }

  if (profile.age >= 65) {
    factor += 0.25;
  }

  if (status.symptoms.length > 0) {
    factor += 0.5;
  }

  return factor;
}

function coolingNeedFactor(profile: UserProfile, status: CurrentStatus, weather: WeatherLike = mockWeather) {
  const weatherScore = weatherStressScore(weather);
  const vulnerability = profileVulnerabilityScore(profile, status);

  return 1 + weatherScore * 0.08 + vulnerability * 0.03;
}

export function classifyRisk(profile: UserProfile, status: CurrentStatus, weather: WeatherLike = mockWeather): RiskResult {
  const emergencySignals = status.symptoms.filter((symptom) =>
    emergencySymptoms.includes(symptom),
  );

  if (emergencySignals.length > 0) {
    return {
      level: "emergency",
      title: "응급 위험 신호가 있습니다",
      guidance: "즉시 시원한 곳으로 이동하고 119 상담을 권장합니다.",
      signals: emergencySignals.map((symptom) => symptomLabels[symptom]),
    };
  }

  let score = 0;
  const signals: string[] = [];
  const weatherScore = weatherStressScore(weather);
  const cautionCount = status.symptoms.filter((symptom) =>
    cautionSymptoms.includes(symptom),
  ).length;

  if (cautionCount > 0) {
    score += cautionCount * 2;
    signals.push("온열질환 위험 신호");
  }

  if (weatherScore >= 5) {
    score += 2;
    signals.push("현재 날씨 위험 높음");
  } else if (weatherScore >= 3) {
    score += 1;
    signals.push("현재 날씨 더움");
  }

  if (profile.age >= 65) {
    score += 2;
    signals.push("고령자");
  }

  if (profile.hasChronicDisease) {
    score += 2;
    signals.push("만성질환 있음");
  }

  if (!profile.hasAirConditioner) {
    score += 1;
    signals.push("냉방기 없음");
  }

  if (profile.transport === "walk") {
    score += 1;
    signals.push("도보 이동");
  }

  if (profile.traits.includes("outdoorWorker")) {
    score += 2;
    signals.push("야외활동 많음");
  }

  if (status.activityStatus === "outdoor" || status.activityStatus === "planned") {
    if (status.outdoorMinutes >= 300) {
      score += 3;
    } else if (status.outdoorMinutes >= 60) {
      score += 2;
    } else if (status.outdoorMinutes > 0) {
      score += 1;
    }
    signals.push("외부활동 노출");
  }

  if (score >= 4) {
    return {
      level: "caution",
      title: "주의가 필요합니다",
      guidance: "가까운 무더위쉼터로 이동하고 증상이 계속되면 의료기관 상담을 권장합니다.",
      signals: Array.from(new Set(signals)),
    };
  }

  return {
    level: "normal",
    title: "예방 관리가 필요합니다",
    guidance: "수분을 섭취하고 더운 시간대의 야외활동을 줄여 주세요.",
    signals: status.symptoms.map((symptom) => symptomLabels[symptom]),
  };
}

export function classifyHospitalRisk(
  profile: UserProfile,
  status: HospitalSearchStatus,
  weather: WeatherLike = mockWeather,
): RiskResult {
  const severities = status.severities;
  const emergencySignals = emergencySymptoms.filter((symptom) => severities[symptom] >= 3);

  if (status.emergencyFromShelter || emergencySignals.length > 0) {
    return {
      level: "emergency",
      title: "응급 위험 신호가 있습니다",
      guidance: "119 상담을 먼저 권장합니다. 가능한 경우 가까운 의료기관에 전화해 안내를 받으세요.",
      signals: status.emergencyFromShelter
        ? ["쉼터 찾기에서 응급 위험 신호 체크"]
        : emergencySignals.map((symptom) => symptomLabels[symptom]),
    };
  }

  let score = 0;
  const signals: string[] = [];

  (Object.entries(severities) as Array<[SymptomId, number]>).forEach(([symptom, severity]) => {
    if (severity <= 0) {
      return;
    }

    score += severity;
    signals.push(symptomLabels[symptom] + " " + severity + "점");
  });

  if (profile.age >= 65) {
    score += 2;
  }

  if (profile.hasChronicDisease) {
    score += 2;
  }

  if (weatherStressScore(weather) >= 5) {
    score += 1;
  }

  if (score >= 6) {
    return {
      level: "caution",
      title: "의료기관 상담을 권장합니다",
      guidance: "증상 강도가 높습니다. 가까운 병원 후보를 확인하고 전화 상담을 권장합니다.",
      signals,
    };
  }

  return {
    level: "normal",
    title: "예방 관리가 필요합니다",
    guidance: "증상이 약하면 수분 섭취와 휴식을 먼저 해주세요. 증상이 계속되면 상담을 권장합니다.",
    signals,
  };
}

function nearestHospitalForShelter(
  shelter: CoolingShelter,
  hospitals: MedicalFacility[],
) {
  return hospitals
    .map((hospital) => ({
      hospital,
      distance: distanceKm(shelter, hospital),
    }))
    .sort((a, b) => a.distance - b.distance)[0]!;
}

function comfortScore(shelter: CoolingShelter) {
  return (
    shelter.airConditioners * 10 +
    shelter.fans * 4 +
    shelter.capacity * 1.2 +
    shelter.areaM2 * 0.25
  );
}

function makeReasons(
  shelter: CoolingShelter,
  distance: number,
  hospitalDistance: number,
  profile: UserProfile,
  status: CurrentStatus,
  weather: WeatherLike = mockWeather,
) {
  const reasons = [
    "현재 위치에서 " + formatDistance(distance),
    "에어컨 " + shelter.airConditioners + "대",
    "수용 " + shelter.capacity + "명",
  ];

  if (hospitalDistance <= 1.5) {
    reasons.push("의료기관 " + formatDistance(hospitalDistance));
  }

  if (profile.transport === "walk") {
    reasons.push("도보 이동 고려");
  }

  if (profile.age >= 65) {
    reasons.push("고령자 우선 고려");
  }

  if (weatherStressScore(weather) >= 5) {
    reasons.push("현재 날씨 반영");
  }

  if (status.symptoms.length > 0) {
    reasons.push("증상 입력 반영");
  }

  return reasons;
}

export function recommendShelters(
  shelters: CoolingShelter[],
  hospitals: MedicalFacility[],
  profile: UserProfile,
  status: CurrentStatus,
  userLocation: GeoPoint,
  currentWeather: WeatherLike = mockWeather,
): ShelterRecommendation[] {
  if (shelters.length === 0 || hospitals.length === 0) {
    return [];
  }

  const weather = weatherStressScore(currentWeather);
  const moveFactor = movementPenaltyFactor(profile);
  const weatherDistanceMultiplier = 1 + weather * 0.1;
  const medFactor = medicalNeedFactor(profile, status);
  const coolFactor = coolingNeedFactor(profile, status, currentWeather);

  const enriched = shelters.map((shelter) => {
    const userDistance = distanceKm(userLocation, shelter);
    const nearestHospital = nearestHospitalForShelter(shelter, hospitals);
    const comfort = comfortScore(shelter);
    const distancePenalty = userDistance * moveFactor * weatherDistanceMultiplier;
    const hospitalPenalty = nearestHospital.distance * 14 * medFactor;

    return {
      shelter,
      userDistance,
      nearestHospital,
      comfort,
      distancePenalty,
      hospitalPenalty,
      fastScore: -userDistance * moveFactor,
      comfortFitScore: comfort * coolFactor - distancePenalty - hospitalPenalty * 0.35,
      medicalFitScore: comfort * 0.2 - distancePenalty - nearestHospital.distance * 35 * medFactor,
      balancedScore: comfort * 0.65 * coolFactor - distancePenalty - hospitalPenalty,
    };
  });

  const picks = [
    {
      title: "가장 빠른 쉼터",
      item: [...enriched].sort((a, b) => b.fastScore - a.fastScore)[0]!,
    },
    {
      title: "가장 쾌적한 쉼터",
      item: [...enriched].sort((a, b) => b.comfortFitScore - a.comfortFitScore)[0]!,
    },
    {
      title: "의료기관과 가까운 쉼터",
      item: [...enriched].sort((a, b) => b.medicalFitScore - a.medicalFitScore)[0]!,
    },
  ];

  const used = new Set<string>();

  return picks.map((pick) => {
    let item = pick.item;

    if (used.has(item.shelter.id)) {
      const fallback = [...enriched]
        .filter((candidate) => !used.has(candidate.shelter.id))
        .sort((a, b) => b.balancedScore - a.balancedScore)[0];

      if (fallback) {
        item = fallback;
      }
    }

    used.add(item.shelter.id);

    return {
      title: pick.title,
      shelter: item.shelter,
      distanceKm: item.userDistance,
      nearestHospitalName: item.nearestHospital.hospital.name,
      nearestHospitalDistanceKm: item.nearestHospital.distance,
      score: Math.round(item.balancedScore),
      reasons: makeReasons(
        item.shelter,
        item.userDistance,
        item.nearestHospital.distance,
        profile,
        status,
        currentWeather,
      ),
    };
  });
}

export function recommendHospitals(
  hospitals: MedicalFacility[],
  status: CurrentStatus,
  userLocation: GeoPoint,
  profile?: UserProfile,
  currentWeather: WeatherLike = mockWeather,
): HospitalRecommendation[] {
  const symptomRelated =
    status.symptoms.length > 0
      ? ["증상 입력 반영", "전화 상담 후보"]
      : ["예방 상담 후보"];

  return hospitals
    .map((hospital) => {
      const distance = distanceKm(userLocation, hospital);
      const hasInternalMedicine = hospital.departments.includes("내과");
      const isHospitalLevel = hospital.type.includes("병원");
      const score =
        -distance * 10 +
        (hasInternalMedicine ? 4 : 0) +
        (status.symptoms.length > 0 && hasInternalMedicine ? 3 : 0) +
        (profile?.age && profile.age >= 65 && isHospitalLevel ? 2 : 0) +
        (profile?.hasChronicDisease && hasInternalMedicine ? 2 : 0) +
        (weatherStressScore(currentWeather) >= 5 && hasInternalMedicine ? 1 : 0);

      const reasons = [
        ...symptomRelated,
        hasInternalMedicine ? "내과 진료과목 포함" : "일반 진료 가능",
      ];

      if (profile?.age && profile.age >= 65 && isHospitalLevel) {
        reasons.push("고령자 병원급 후보");
      }

      return {
        hospital,
        distanceKm: distance,
        reasons,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ hospital, distanceKm, reasons }) => ({ hospital, distanceKm, reasons }));
}

export function kakaoSearchUrl(query: string) {
  return "https://map.kakao.com/link/search/" + encodeURIComponent(query);
}

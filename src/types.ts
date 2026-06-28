export type ViewId = "account" | "shelter" | "shelterResult" | "hospital" | "hospitalResult" | "easy" | "status";

export type TransportMode = "walk" | "bus" | "car" | "caregiver";

export type SpecialTrait = "outdoorWorker" | "limitedMobility";

export type ActivityStatus = "indoor" | "outdoor" | "planned";

export type RiskLevel = "normal" | "caution" | "emergency";

export type SymptomId =
  | "dizziness"
  | "nausea"
  | "headache"
  | "heavySweat"
  | "muscleCramp"
  | "fatigue"
  | "confusion"
  | "highFever"
  | "breathingTrouble"
  | "repeatedVomiting";

export type SymptomSeverity = Record<SymptomId, number>;

export interface UserProfile {
  displayName: string;
  phone: string;
  homeGu: string;
  homeArea: string;
  age: number;
  hasChronicDisease: boolean;
  hasAirConditioner: boolean;
  transport: TransportMode | "";
  traits: SpecialTrait[];
  easyMode: boolean;
}

export interface CurrentStatus {
  activityStatus: ActivityStatus;
  outdoorMinutes: number;
  symptoms: SymptomId[];
}

export interface ShelterSearchStatus {
  activityStatus: ActivityStatus;
  outdoorMinutes: number;
  hasEmergencySignal: boolean;
}

export interface HospitalSearchStatus {
  severities: SymptomSeverity;
  emergencyFromShelter: boolean;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CoolingShelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  areaM2: number;
  capacity: number;
  airConditioners: number;
  fans: number;
  note: string;
}

export interface MedicalFacility {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  type: string;
  departments: string;
}

export interface ShelterRecommendation {
  shelter: CoolingShelter;
  title: string;
  distanceKm: number;
  nearestHospitalName: string;
  nearestHospitalDistanceKm: number;
  score: number;
  reasons: string[];
}

export interface HospitalRecommendation {
  hospital: MedicalFacility;
  distanceKm: number;
  reasons: string[];
}

export interface RiskResult {
  level: RiskLevel;
  title: string;
  guidance: string;
  signals: string[];
}

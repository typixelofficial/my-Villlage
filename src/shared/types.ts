export type Gender = 'male' | 'female';
export type HairStyle =
  | 'short'
  | 'long'
  | 'spiky'
  | 'bob'
  | 'ponytail'
  | 'braids'
  | 'fade'
  | 'curly';
export type ShirtStyle =
  | 'tee'
  | 'jacket'
  | 'hoodie'
  | 'polo'
  | 'shirt'
  | 'mundu'
  | 'dress'
  | 'kurti'
  | 'lehenga';
export type AccessoryType = 'none' | 'glasses' | 'cap' | 'backpack' | 'headphones';
export type AnimationState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'drive'
  | 'wave'
  | 'dance'
  | 'cheer'
  | 'sit'
  | 'clap';
export type EmoteType = 'wave' | 'dance' | 'cheer' | 'sit' | 'clap';
export type InteriorTheme = 'modern' | 'cozy' | 'minimal' | 'luxury';
export type GardenStyle = 'flowers' | 'zen' | 'poolside' | 'orchard';
export type CustomHomeStyle = 'cabin' | 'modern' | 'villa' | 'manor';
export type CustomShopType = 'tea_stall' | 'juice_bar' | 'bakery' | 'boutique' | 'tech_shop';
export type RelationshipStatus = 'single' | 'mingle' | 'married';
export type LocationCategory = 'favorite' | 'home' | 'hangout' | 'tea' | 'event';
export type WeatherMode = 'clear' | 'breeze' | 'rain' | 'mist';
export type TimeOfDayMode = 'cycle' | 'morning' | 'noon' | 'golden' | 'night';

export type DistrictId =
  | 'plaza'
  | 'residential'
  | 'commercial'
  | 'entertainment'
  | 'sports'
  | 'education_health'
  | 'transport'
  | 'sunset_valley'
  | 'emerald_highway';

export interface CharacterAppearance {
  gender: Gender;
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  shirtStyle: ShirtStyle;
  shirtColor: string;
  pantsColor: string;
  shoeColor: string;
  accessory: AccessoryType;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CustomLocationPin {
  id: string;
  name: string;
  category: LocationCategory;
  x: number;
  z: number;
}

export interface PlayerProfile {
  uid: string;
  displayName: string;
  instagramId: string;
  photoURL: string;
  age: number;
  relationshipStatus: RelationshipStatus;
  partnerUid: string;
  partnerName: string;
  partnerInstagram: string;
  lastDailyLoginDate: string;
  dailyLoginStreak: number;
  totalDailyLogins: number;
  followedOfficial: boolean;
  followedStudio: boolean;
  customLocations: CustomLocationPin[];
  appearance: CharacterAppearance;
  greenCoins: number;
  level: number;
  xp: number;
  ownedProperties: string[];
  ownedBusinesses: string[];
  ownedVehicles: string[];
  completedMissions: string[];
  claimedRewards: string[];
  inventory: string[];
  friends: string[];
  lastPosition: Vec3;
}

export interface WalletTransaction {
  id: string;
  uid: string;
  type: 'earn' | 'spend';
  amount: number;
  reason: string;
  balanceAfter: number;
  createdAtMs: number;
}

export interface NetworkPlayer {
  uid: string;
  displayName: string;
  instagramId: string;
  photoURL: string;
  age?: number;
  relationshipStatus?: RelationshipStatus;
  partnerName?: string;
  appearance: CharacterAppearance;
  x: number;
  y: number;
  z: number;
  rotY: number;
  anim: AnimationState;
  speed: number;
  vehicleId: string | null;
  emoteUntil?: number;
  chatBubble?: string;
  chatBubbleUntil?: number;
  level: number;
  isAdmin?: boolean;
  voiceActive?: boolean;
  voiceMuted?: boolean;
}

export type VehicleKind =
  | 'electric'
  | 'sports'
  | 'suv'
  | 'motorcycle'
  | 'bicycle'
  | 'flying_taxi'
  | 'ksrtc_bus';

export interface VehicleState {
  id: string;
  name: string;
  kind: VehicleKind;
  color: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  driverUid: string | null;
  maxSpeed: number;
  accel: number;
  turnSpeed: number;
  canFly: boolean;
  rentPrice: number;
  buyPrice: number;
}

export interface PropertyDef {
  id: string;
  name: string;
  category: 'cottage' | 'villa' | 'apartment' | 'manor';
  district: DistrictId;
  price: number;
  position: Vec3;
  doorPosition: Vec3;
  size: Vec3;
  color: string;
  roofColor: string;
  hasPool?: boolean;
  description: string;
}

export interface WorldPropertyOwnership {
  propertyId: string;
  ownerUid: string;
  ownerName: string;
  interiorTheme: InteriorTheme;
  gardenStyle: GardenStyle;
}

export interface CustomHomeDef {
  homeId: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  ownerInstagram: string;
  createdByAdmin: boolean;
  style: CustomHomeStyle;
  wallColor: string;
  roofColor: string;
  hasPool: boolean;
  interiorTheme: InteriorTheme;
  gardenStyle: GardenStyle;
  x: number;
  y: number;
  z: number;
}

export interface CustomHomePlan {
  style: CustomHomeStyle;
  label: string;
  price: number;
  size: Vec3;
  defaultPool: boolean;
  description: string;
}

export interface CustomShopDef {
  shopId: string;
  name: string;
  shopType: CustomShopType;
  ownerUid: string;
  ownerName: string;
  ownerInstagram: string;
  awningColor: string;
  x: number;
  y: number;
  z: number;
  totalSales: number;
}

export interface CustomShopPlan {
  shopType: CustomShopType;
  label: string;
  price: number;
  defaultAwning: string;
  description: string;
  menuItems: { id: string; name: string; price: number; healthRestore: number; xp: number }[];
}

export interface ActiveBuildingDef {
  id: string;
  name: string;
  category:
    | 'hospital'
    | 'mall'
    | 'bank'
    | 'school'
    | 'college'
    | 'library'
    | 'cinema'
    | 'gym'
    | 'ksrtc_depot'
    | 'airport'
    | 'wedding_hall'
    | 'honeymoon_resort';
  doorPosition: Vec3;
  subtitle: string;
  description: string;
  accent: string;
  services: {
    id: string;
    label: string;
    description: string;
    cost: number;
    rewardCoins?: number;
    rewardXp?: number;
    healthRestore?: number;
    teleportTo?: Vec3;
    teleportLabel?: string;
    openPanel?: 'inventory' | 'wallet' | 'mingle' | 'vehicles';
  }[];
}

export interface ShowcaseAdItem {
  id: string;
  filename: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  instagramUrl: string;
}

export interface MingleParticipant {
  uid: string;
  displayName: string;
  instagramId: string;
  photoURL: string;
  age: number;
  gender: Gender;
  relationshipStatus: RelationshipStatus;
  appearance: CharacterAppearance;
  joinedAt: number;
  isOnline: boolean;
  isNpc?: boolean;
}

export interface MingleSelectedPair {
  matchId: string;
  memberA: MingleParticipant;
  memberB: MingleParticipant;
  selectedAt: number;
  locationName: string;
  locationPos: Vec3;
  status: 'proposed' | 'married' | 'honeymoon';
  memberAAccepted: boolean;
  memberBAccepted: boolean;
  feastServed?: boolean;
}

export interface MingleEventState {
  nextEventAtMs: number;
  alarmActive: boolean;
  locationName: string;
  locationPos: Vec3;
  isJoined?: boolean;
  joinedAccounts?: MingleParticipant[];
  selectedPair?: MingleSelectedPair | null;
  activeMatch: {
    matchId: string;
    partnerUid: string;
    partnerName: string;
    partnerInstagram: string;
    partnerPhotoURL?: string;
    partnerAppearance?: CharacterAppearance;
    partnerAge: number;
    partnerGender: Gender;
    isNpcPartner: boolean;
    myAccepted: boolean;
    partnerAccepted: boolean;
    status: 'proposed' | 'accepted' | 'married' | 'honeymoon' | 'declined';
    feastServed?: boolean;
  } | null;
}

export interface BusinessDef {
  id: string;
  name: string;
  category: 'cafe' | 'restaurant' | 'hotel' | 'supermarket' | 'gaming';
  district: DistrictId;
  price: number;
  payout: number;
  cooldownSec: number;
  position: Vec3;
  description: string;
}

export interface WorkJobDef {
  id: string;
  title: string;
  role: string;
  district: DistrictId;
  payout: number;
  xp: number;
  cooldownSec: number;
  station: Vec3;
  target: Vec3;
  targetName: string;
  description: string;
}

export interface ActiveWorkShift {
  jobId: string;
  title: string;
  target: Vec3;
  targetName: string;
  payout: number;
  xp: number;
  startedAt: number;
}

export interface RewardDef {
  id: string;
  title: string;
  description: string;
  coins: number;
  xp: number;
  repeatableSec?: number;
}

export interface MissionDef {
  id: string;
  title: string;
  category: 'delivery' | 'taxi' | 'explore' | 'sports' | 'adventure';
  description: string;
  objectiveText: string;
  target: Vec3;
  targetName: string;
  rewardCoins: number;
  rewardXp: number;
}

export interface ShopItemDef {
  id: string;
  name: string;
  category: 'consumable' | 'gear' | 'collectible';
  price: number;
  description: string;
  healthRestore?: number;
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  position: Vec3;
  rotY: number;
  dialogue: string;
  shirtColor: string;
  pantsColor: string;
  skinTone: string;
  hairColor: string;
}

export interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  instagramId?: string;
  isAdmin?: boolean;
  photoURL: string;
  channel: 'global' | 'proximity' | 'direct' | 'system';
  targetUid?: string;
  targetName?: string;
  text: string;
  timestamp: number;
}

export interface FriendRequest {
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  timestamp: number;
}

export interface InteractablePrompt {
  id: string;
  type:
    | 'vehicle'
    | 'property'
    | 'custom_home'
    | 'custom_shop'
    | 'building'
    | 'business'
    | 'atm'
    | 'npc'
    | 'mission'
    | 'work'
    | 'shop';
  label: string;
  sublabel?: string;
  targetId: string;
  position: Vec3;
}

export interface GameToast {
  id: string;
  title: string;
  detail?: string;
  tone: 'emerald' | 'amber' | 'sky' | 'rose';
  createdAt: number;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  gender: 'male',
  skinTone: '#e8be9e',
  hairStyle: 'short',
  hairColor: '#2c221e',
  shirtStyle: 'jacket',
  shirtColor: '#1f7a5c',
  pantsColor: '#283344',
  shoeColor: '#e5e7eb',
  accessory: 'none',
};

export const DEFAULT_FEMALE_APPEARANCE: CharacterAppearance = {
  gender: 'female',
  skinTone: '#e8be9e',
  hairStyle: 'long',
  hairColor: '#2c221e',
  shirtStyle: 'dress',
  shirtColor: '#e11d48',
  pantsColor: '#fda4af',
  shoeColor: '#f8fafc',
  accessory: 'none',
};

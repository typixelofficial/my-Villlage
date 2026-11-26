import type {
  ActiveBuildingDef,
  BusinessDef,
  CustomHomePlan,
  CustomHomeStyle,
  CustomShopPlan,
  DistrictId,
  Gender,
  MiniGameDef,
  MissionDef,
  NpcDef,
  PalaceVillaDef,
  PropertyDef,
  RewardDef,
  ShopItemDef,
  ShopSizeTier,
  ShowcaseAdItem,
  Vec3,
  VehicleState,
  WorkJobDef,
} from './types.ts';

// Expansive 1120m x 1120m Open World (Admin can dynamically expand up to 1900m x 1900m!)
export const WORLD_HALF_SIZE = 560;
export const MAX_WORLD_HALF_SIZE = 950;
export const WORLD_SPAWN = { x: 0, y: 0, z: 16 };

// High-Risk North Ridge Cliff location for the Hidden Game Center Entrance Card
export const HIDDEN_CARD_POS: Vec3 = { x: -208, y: 17.4, z: -252 };
export const HIDDEN_CARD_CLUES: string[] = [
  'Clue 1: Leave the main roads and travel far North-West past Oakwood & Sunset Valley.',
  'Clue 2: Look for the towering jagged Danger Peak Cliff rising steeply above the northern valley mist.',
  'Clue 3: Climb carefully up the rocky narrow trail on the high-risk cliff (watch your HP — falling hurts!).',
  'Clue 4: At the very summit spire (near -208, -252), a spinning golden VIP Entrance Card awaits.',
];

// Playable 3D Sports Venues (Sports Complex North-East)
export const FOOTBALL_PITCH_CENTER: Vec3 = { x: 112, y: 0, z: -98 };
export const VOLLEYBALL_COURT_CENTER: Vec3 = { x: 112, y: 0, z: -56 };

/**
 * Deterministic terrain elevation shared by Three.js terrain mesh, physics, and server.
 * Extended flat valley core supports large village plots + High-Risk North Peak Cliff.
 */
export function groundHeightAt(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Lake basin in the south-west (centered around x = -115, z = 115)
  const lakeDist = Math.hypot((x + 115) / 1.25, (z - 115) / 1.0);
  if (lakeDist < 62) {
    const t = Math.max(0, 1 - lakeDist / 62);
    return -2.4 * t * t;
  }

  // Flowing river channel feeding into the lake
  const riverCenterX = -152 + Math.sin(z * 0.02) * 20;
  const riverDist = Math.abs(x - riverCenterX);
  if (z > -120 && z < 85 && riverDist < 12) {
    const bridgeFactor = Math.min(1, Math.abs(z) / 11);
    const t = 1 - riverDist / 12;
    return -1.4 * t * t * bridgeFactor;
  }

  // High-Risk Danger Peak Cliff (North-West at -208, -252) holding the Hidden Entrance Card
  const cliffDist = Math.hypot(x + 208, z + 252);
  if (cliffDist < 42) {
    const t = Math.max(0, 1 - cliffDist / 42);
    return 17.2 * Math.pow(t, 1.35);
  }

  // Wide playable valley floor across the expanded village & buildable plots
  if (distFromCenter < 480) {
    return 0;
  }

  // Rolling alpine foothills rising naturally toward the mountain perimeter
  const rimT = Math.min(1, (distFromCenter - 480) / 160);
  const hillNoise =
    Math.sin(x * 0.018) * Math.cos(z * 0.016) * 7.5 +
    Math.sin((x + z) * 0.013) * 5.0 +
    15;
  return rimT * rimT * hillNoise;
}

export const PALACE_VILLAS: PalaceVillaDef[] = [
  {
    villaId: 'hashim_villa',
    boardName: "Hashim's Villa",
    ownerUsername: '__hashim_mhd_',
    ownerDisplayName: 'Hashim',
    visitFee: 150,
    hasKeySet: true,
    x: -185,
    z: 52,
    gatePos: { x: -162, y: 0, z: 52 },
    doorPos: { x: -185, y: 0, z: 64 },
    wallSize: { w: 46, d: 42 },
    accentColor: '#f59e0b',
  },
  {
    villaId: 'rifad_villa',
    boardName: "Rifad's Villa",
    ownerUsername: '_rifadeeyy',
    ownerDisplayName: 'Rifad',
    visitFee: 150,
    hasKeySet: false,
    x: 185,
    z: -52,
    gatePos: { x: 162, y: 0, z: -52 },
    doorPos: { x: 185, y: 0, z: -40 },
    wallSize: { w: 46, d: 42 },
    accentColor: '#38bdf8',
  },
];

/**
 * Strict Road, Plaza, Water, Sports Field & Palace Compound clearance validator.
 * Prevents ANY custom house or shop from ever spawning on a road or restricted landmark!
 */
export function isPositionOnRoad(
  x: number,
  z: number,
  clearance = 13,
): { onRoad: boolean; reason?: string } {
  // 1. Main North-South Grand Highway (x = 0)
  if (Math.abs(x) < 11 + clearance * 0.5) {
    return { onRoad: true, reason: 'Blocked: On the North-South Main Highway' };
  }
  // 2. Main East-West Valley Avenue (z = 0)
  if (Math.abs(z) < 11 + clearance * 0.5) {
    return { onRoad: true, reason: 'Blocked: On the East-West Main Avenue' };
  }
  // 3. Central Fountain Plaza roundabout
  if (Math.hypot(x, z) < 30 + clearance * 0.5) {
    return { onRoad: true, reason: 'Blocked: Inside Central Fountain Plaza' };
  }
  // 4. Secondary Commercial/Residential Ring Roads (x = ±56, z = ±72)
  if (Math.abs(Math.abs(x) - 56) < 8 && Math.abs(z) < 120) {
    return { onRoad: true, reason: 'Blocked: On Valley Ring Road' };
  }
  if (Math.abs(Math.abs(z) - 72) < 8 && Math.abs(x) < 120) {
    return { onRoad: true, reason: 'Blocked: On Valley Cross Street' };
  }
  // 5. Lake & River water channels
  if (groundHeightAt(x, z) < -0.35) {
    return { onRoad: true, reason: 'Blocked: Over Emerald Lake or River water' };
  }
  // 6. Airport Runway
  if (x > 72 && x < 146 && z > 88 && z < 134) {
    return { onRoad: true, reason: 'Blocked: On Valley Airport Runway' };
  }
  // 7. Sports Complex Football & Volleyball fields
  if (Math.hypot(x - FOOTBALL_PITCH_CENTER.x, z - FOOTBALL_PITCH_CENTER.z) < 28) {
    return { onRoad: true, reason: 'Blocked: On Football Pitch' };
  }
  if (Math.hypot(x - VOLLEYBALL_COURT_CENTER.x, z - VOLLEYBALL_COURT_CENTER.z) < 18) {
    return { onRoad: true, reason: 'Blocked: On Volleyball Court' };
  }
  // 8. Hashim's Villa & Rifad's Villa Walled Palace Compounds
  for (const v of PALACE_VILLAS) {
    if (
      Math.abs(x - v.x) < v.wallSize.w * 0.5 + 9 &&
      Math.abs(z - v.z) < v.wallSize.d * 0.5 + 9
    ) {
      return { onRoad: true, reason: `Blocked: Inside ${v.boardName} Palace Compound` };
    }
  }
  // 9. High-Risk Cliff Peak
  if (Math.hypot(x - HIDDEN_CARD_POS.x, z - HIDDEN_CARD_POS.z) < 44) {
    return { onRoad: true, reason: 'Blocked: Steep High-Risk Cliff Zone' };
  }
  return { onRoad: false };
}

export const SHOP_SIZE_TIERS: {
  tier: ShopSizeTier;
  label: string;
  priceMultiplier: number;
  scale: number;
  desc: string;
}[] = [
  { tier: 'small', label: 'Small Stall', priceMultiplier: 1.0, scale: 1.0, desc: 'Compact roadside stall' },
  { tier: 'medium', label: 'Medium Shop', priceMultiplier: 1.7, scale: 1.32, desc: 'Wider counter & display shelf' },
  { tier: 'large', label: 'Large Showroom', priceMultiplier: 2.6, scale: 1.65, desc: 'Spacious double-bay shopfront' },
  { tier: 'palace', label: 'Palace Emporium', priceMultiplier: 4.0, scale: 2.05, desc: 'Grand flagship commercial hall' },
];

export function computeHouseTotalPrice(
  style: CustomHomeStyle,
  facilities: { hasPool?: boolean; hasGarden?: boolean; hasAc?: boolean },
): number {
  const plan = CUSTOM_HOME_PLANS.find((p) => p.style === style) || CUSTOM_HOME_PLANS[0];
  let total = plan.price;
  if (facilities.hasPool && !plan.defaultPool) total += 450;
  if (facilities.hasGarden) total += 250;
  if (facilities.hasAc) total += 300;
  return total;
}

export function computeShopTotalPrice(
  basePrice: number,
  sizeTier: ShopSizeTier,
  facilities: { hasSeating?: boolean; hasAc?: boolean },
): number {
  const tierObj = SHOP_SIZE_TIERS.find((t) => t.tier === sizeTier) || SHOP_SIZE_TIERS[0];
  let total = Math.round(basePrice * tierObj.priceMultiplier);
  if (facilities.hasSeating) total += 220;
  if (facilities.hasAc) total += 300;
  return total;
}

export interface DistrictZone {
  id: DistrictId;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  radius: number;
  color: string;
}

export const DISTRICTS: DistrictZone[] = [
  {
    id: 'plaza',
    name: 'Central Fountain Square',
    subtitle: 'Heart of Green Valley',
    x: 0,
    z: 0,
    radius: 30,
    color: '#10b981',
  },
  {
    id: 'residential',
    name: 'Oakwood Residential',
    subtitle: 'Villas, cottages & apartments',
    x: -72,
    z: -62,
    radius: 64,
    color: '#34d399',
  },
  {
    id: 'commercial',
    name: 'Green Valley Commercial',
    subtitle: 'Mall, cafes, bank & hotel',
    x: 72,
    z: -6,
    radius: 58,
    color: '#f59e0b',
  },
  {
    id: 'entertainment',
    name: 'Lakeside Entertainment & Beach',
    subtitle: 'Cinema, water park, beach & camp',
    x: -36,
    z: 102,
    radius: 72,
    color: '#38bdf8',
  },
  {
    id: 'sports',
    name: 'Valley Sports Complex',
    subtitle: 'Cricket stadium, football & gym',
    x: 92,
    z: -96,
    radius: 62,
    color: '#22c55e',
  },
  {
    id: 'education_health',
    name: 'Civic Campus & Hospital',
    subtitle: 'School, college, library & hospital',
    x: -4,
    z: -102,
    radius: 52,
    color: '#fb7185',
  },
  {
    id: 'transport',
    name: 'Valley Transport Hub',
    subtitle: 'Airport, SkyCab pad & showroom',
    x: 86,
    z: 96,
    radius: 64,
    color: '#a78bfa',
  },
  {
    id: 'sunset_valley',
    name: 'Sunset Valley Home Plots',
    subtitle: 'Open residential land for custom homes',
    x: -225,
    z: -75,
    radius: 95,
    color: '#f472b6',
  },
  {
    id: 'emerald_highway',
    name: 'Emerald Grand Highway',
    subtitle: 'Long scenic valley stretch & estates',
    x: 185,
    z: 195,
    radius: 120,
    color: '#2dd4bf',
  },
];

export function getDistrictAt(x: number, z: number): DistrictZone {
  let closest = DISTRICTS[0];
  let bestScore = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.x, z - d.z);
    if (dist <= d.radius && dist < bestScore) {
      bestScore = dist;
      closest = d;
    }
  }
  if (bestScore === Infinity) {
    for (const d of DISTRICTS) {
      const dist = Math.hypot(x - d.x, z - d.z);
      if (dist < bestScore) {
        bestScore = dist;
        closest = d;
      }
    }
  }
  return closest;
}

export const CUSTOM_HOME_PLANS: CustomHomePlan[] = [
  {
    style: 'cabin',
    tierLabel: 'Small',
    label: 'Small Cozy Cottage',
    price: 550,
    size: { x: 9, y: 5.8, z: 8 },
    defaultPool: false,
    description: 'Compact starter cottage with pitched roof & clear signboard.',
  },
  {
    style: 'modern',
    tierLabel: 'Medium',
    label: 'Medium Family House',
    price: 1250,
    size: { x: 12.5, y: 7.6, z: 10.5 },
    defaultPool: false,
    description: 'Two-floor contemporary family residence with panoramic windows.',
  },
  {
    style: 'villa',
    tierLabel: 'Large',
    label: 'Large Luxury Villa',
    price: 2400,
    size: { x: 15.5, y: 9.2, z: 12.5 },
    defaultPool: true,
    description: 'Spacious architectural villa complete with private turquoise pool deck.',
  },
  {
    style: 'manor',
    tierLabel: 'Palace',
    label: 'Grand Royal Palace',
    price: 4500,
    size: { x: 19.5, y: 12.4, z: 15.5 },
    defaultPool: true,
    description: 'Monumental multi-story palace estate with pool, terrace, and grand pillars.',
  },
];

// Clean core starter properties (trimmed extra duplicate houses as requested)
export const PROPERTIES: PropertyDef[] = [
  {
    id: 'prop-timber-cottage',
    name: 'Pine Timber Cottage',
    category: 'cottage',
    district: 'residential',
    price: 600,
    position: { x: -42, y: 0, z: -36 },
    doorPosition: { x: -42, y: 0, z: -29.5 },
    size: { x: 10, y: 6.5, z: 9 },
    color: '#d6c3a5',
    roofColor: '#5c4033',
    description: 'Cozy stone-and-timber starter cottage overlooking the central avenue.',
  },
  {
    id: 'prop-lakeview-villa',
    name: 'Lakeview Pool Villa',
    category: 'villa',
    district: 'residential',
    price: 1400,
    position: { x: -78, y: 0, z: -48 },
    doorPosition: { x: -78, y: 0, z: -40.5 },
    size: { x: 14, y: 8.5, z: 11 },
    color: '#f2f0eb',
    roofColor: '#2c3e50',
    hasPool: true,
    description: 'Two-story residential villa with private pool and terrace lounge.',
  },
];

export const BUSINESSES: BusinessDef[] = [
  {
    id: 'biz-sunset-cafe',
    name: 'Sunset Roasters Café',
    category: 'cafe',
    district: 'commercial',
    price: 900,
    payout: 180,
    cooldownSec: 45,
    position: { x: 42, y: 0, z: -24 },
    description: 'Artisanal lakeside coffee bar earning steady Green Coins from commuters.',
  },
  {
    id: 'biz-emerald-bistro',
    name: 'Emerald Bistro Restaurant',
    category: 'restaurant',
    district: 'commercial',
    price: 1350,
    payout: 280,
    cooldownSec: 50,
    position: { x: 42, y: 0, z: 22 },
    description: 'Fine valley dining venue with terrace seating along Commercial Avenue.',
  },
  {
    id: 'biz-freshmart',
    name: 'FreshMart Supermarket',
    category: 'supermarket',
    district: 'commercial',
    price: 1600,
    payout: 340,
    cooldownSec: 55,
    position: { x: 96, y: 0, z: -28 },
    description: 'Green Valley grocery market serving residential and campus neighborhoods.',
  },
  {
    id: 'biz-grand-hotel',
    name: 'Grand Horizon Hotel',
    category: 'hotel',
    district: 'commercial',
    price: 2600,
    payout: 550,
    cooldownSec: 60,
    position: { x: 100, y: 0, z: 24 },
    description: 'Five-story boutique resort tower hosting travelers from Valley Airport.',
  },
  {
    id: 'biz-pixel-arena',
    name: 'Pixel Gaming Arena',
    category: 'gaming',
    district: 'entertainment',
    price: 1850,
    payout: 410,
    cooldownSec: 50,
    position: { x: 18, y: 0, z: 74 },
    description: 'Multiplayer esports lounge and arcade right beside Starlight Cinema.',
  },
];

/**
 * Walk-up Vehicles:
 * Players MUST physically walk up to a vehicle to take it.
 * - Bicycle is free to take anytime by walking up.
 * - Cars, Motorcycles, SUVs, and SkyCab can be rented per ride OR permanently unlocked with Green Coins!
 */
// Clean essential fleet (trimmed clutter vehicles as requested; full-time autonomous KSRTC Bus runs continuously!)
export const INITIAL_VEHICLES: VehicleState[] = [
  {
    id: 'veh-eco-bike',
    name: 'Greenway City Bike',
    kind: 'bicycle',
    color: '#14b8a6',
    x: 16,
    y: 0,
    z: 16,
    rotY: -Math.PI * 0.5,
    speed: 0,
    driverUid: null,
    maxSpeed: 16,
    accel: 12,
    turnSpeed: 3.1,
    canFly: false,
    rentPrice: 0,
    buyPrice: 0,
  },
  {
    id: 'veh-volt-ev',
    name: 'Volt E-Hatch',
    kind: 'electric',
    color: '#10b981',
    x: -18,
    y: 0,
    z: 18,
    rotY: Math.PI * 0.5,
    speed: 0,
    driverUid: null,
    maxSpeed: 28,
    accel: 18,
    turnSpeed: 2.3,
    canFly: false,
    rentPrice: 40,
    buyPrice: 450,
  },
  {
    id: 'veh-moto-x',
    name: 'Strada Moto X',
    kind: 'motorcycle',
    color: '#f59e0b',
    x: -16,
    y: 0,
    z: 48,
    rotY: 0,
    speed: 0,
    driverUid: null,
    maxSpeed: 36,
    accel: 24,
    turnSpeed: 2.9,
    canFly: false,
    rentPrice: 55,
    buyPrice: 680,
  },
  {
    id: 'veh-ksrtc-plaza',
    name: 'KSRTC Super Fast',
    kind: 'ksrtc_bus',
    color: '#dc2626',
    x: 16,
    y: 0,
    z: 28,
    rotY: -Math.PI * 0.5,
    speed: 0,
    driverUid: null,
    maxSpeed: 31,
    accel: 14,
    turnSpeed: 1.75,
    canFly: false,
    rentPrice: 25,
    buyPrice: 500,
  },
];

export const WEEKLY_REWARD_COOLDOWN_SEC = 7 * 24 * 60 * 60; // 7 days (once a week)
export const PUBLIC_AD_PUBLISH_COST = 200;
export const PUBLIC_BUS_FARE = 15;
export const CONDUCTOR_SALARY_PER_MIN = 72; // 12 GC per 10 seconds on duty

export const PUBLIC_BUS_ROUTE_STOPS: { name: string; x: number; z: number }[] = [
  { name: 'Central Fountain Plaza', x: 0, z: 22 },
  { name: 'Green Valley Ad Center', x: 34, z: 18 },
  { name: 'Grand Valley Mall', x: 56, z: 0 },
  { name: 'Apex Fitness Gym & Stadium', x: 56, z: -72 },
  { name: 'Central Hospital Campus', x: 14, z: -74 },
  { name: 'Emerald Central Park', x: -34, z: -12 },
  { name: 'Royal Wedding Mandapam', x: -96, z: -12 },
  { name: 'Golden Sands Beach Rd', x: -42, z: 68 },
  { name: 'KSRTC Central Bus Terminal', x: 36, z: 72 },
];

export const WORK_JOBS: WorkJobDef[] = [
  {
    id: 'work-auto-driver',
    title: 'Auto Rickshaw Town Trip',
    role: 'Auto Driver',
    district: 'plaza',
    payout: 195,
    xp: 65,
    cooldownSec: 25,
    station: { x: 8, y: 0, z: 18 },
    target: { x: 64, y: 0, z: -2 },
    targetName: 'Grand Valley Mall Auto Stand',
    description: 'Pick up passengers at Central Plaza and complete an Auto Rickshaw fare to Grand Valley Mall.',
  },
  {
    id: 'work-bus-driver',
    title: 'KSRTC Express Bus Route',
    role: 'Bus Driver',
    district: 'transport',
    payout: 280,
    xp: 95,
    cooldownSec: 30,
    station: { x: 42, y: 0, z: 82 },
    target: { x: 14, y: 0, z: -82 },
    targetName: 'Central Hospital Bus Stop',
    description: 'Run a KSRTC Super Fast route from KSRTC Terminal to Central Hospital for a full driver salary.',
  },
  {
    id: 'work-tea-shop',
    title: 'Chaya Kada Tea Shop Shift',
    role: 'Tea Master',
    district: 'commercial',
    payout: 175,
    xp: 60,
    cooldownSec: 25,
    station: { x: 38, y: 0, z: -20 },
    target: { x: -28, y: 0, z: 26 },
    targetName: 'Emerald Central Park Tea Point',
    description: 'Brew fresh Samovar Masala Chai and deliver hot tea flasks to park visitors for your shop salary.',
  },
  {
    id: 'work-hospital-doctor',
    title: 'Hospital Duty Doctor Shift',
    role: 'Duty Doctor',
    district: 'education_health',
    payout: 310,
    xp: 110,
    cooldownSec: 30,
    station: { x: 16, y: 0, z: -86 },
    target: { x: -18, y: 0, z: -96 },
    targetName: 'School Health Checkup Camp',
    description: 'Serve on medical duty from Central Hospital to Green Valley School for a Doctor Salary payout.',
  },
  {
    id: 'work-gym-trainer',
    title: 'Apex Gym Fitness Trainer',
    role: 'Fitness Coach',
    district: 'sports',
    payout: 245,
    xp: 90,
    cooldownSec: 28,
    station: { x: 68, y: 0, z: -76 },
    target: { x: 92, y: 0, z: -96 },
    targetName: 'Valley Cricket Stadium Track',
    description: 'Lead a strength & conditioning workout from Apex Gym to the Stadium Track for coach salary.',
  },
  {
    id: 'work-plaza-courier',
    title: 'Valley Express Courier',
    role: 'Delivery Runner',
    district: 'plaza',
    payout: 185,
    xp: 60,
    cooldownSec: 25,
    station: { x: 4, y: 0, z: 12 },
    target: { x: 42, y: 0, z: -24 },
    targetName: 'Sunset Roasters Café',
    description: 'Walk or drive an express parcel from Central Fountain Square to Sunset Roasters Café.',
  },
  {
    id: 'work-beach-lifeguard',
    title: 'Golden Sands Beach Patrol',
    role: 'Lifeguard',
    district: 'entertainment',
    payout: 240,
    xp: 85,
    cooldownSec: 30,
    station: { x: -40, y: 0, z: 82 },
    target: { x: -60, y: 0, z: 82 },
    targetName: 'Lakeside Wooden Pier End',
    description: 'Complete a safety patrol down the wooden pier overlooking the lake.',
  },
  {
    id: 'work-highway-cargo',
    title: 'Long Highway Supply Run',
    role: 'Valley Logistics',
    district: 'emerald_highway',
    payout: 360,
    xp: 125,
    cooldownSec: 40,
    station: { x: 0, y: 0, z: 24 },
    target: { x: 0, y: 0, z: 240 },
    targetName: 'South Highway Overlook',
    description: 'Long-distance haul down the scenic Emerald Grand Highway for top Green Coins salary.',
  },
];

export const REWARDS: RewardDef[] = [
  {
    id: 'rew-daily-checkin',
    title: 'Weekly Green Valley Stipend (Once / Week)',
    description: 'Claim your resident bonus reward once every 7 days.',
    coins: 500,
    xp: 150,
    repeatableSec: WEEKLY_REWARD_COOLDOWN_SEC,
  },
  {
    id: 'rew-insta-profile',
    title: 'Social Profile Bonus',
    description: 'Add your Instagram ID to your Green Valley profile and claim instant Green Coins.',
    coins: 200,
    xp: 60,
  },
  {
    id: 'rew-first-home',
    title: 'Green Valley Homeowner',
    description: 'Own or build your first home in Green Valley.',
    coins: 350,
    xp: 120,
  },
  {
    id: 'rew-vehicle-owner',
    title: 'Licensed Driver',
    description: 'Permanently unlock any car, motorcycle, SUV, or SkyCab using Green Coins.',
    coins: 250,
    xp: 100,
  },
  {
    id: 'rew-mission-ace',
    title: 'Valley Explorer Milestone',
    description: 'Complete at least 2 Green Valley missions.',
    coins: 400,
    xp: 150,
  },
];

export const MISSIONS: MissionDef[] = [
  {
    id: 'mis-welcome-plaza',
    title: 'Welcome to Green Valley',
    category: 'explore',
    description: 'Meet Mayor Lin at the Central Fountain Square to claim your resident welcome bonus.',
    objectiveText: 'Walk to Central Fountain Square and press E near Mayor Lin',
    target: { x: 6, y: 0, z: 8 },
    targetName: 'Central Fountain Square',
    rewardCoins: 250,
    rewardXp: 80,
  },
  {
    id: 'mis-cafe-delivery',
    title: 'Sunset Café Espresso Drop',
    category: 'delivery',
    description: 'Deliver fresh coffee beans from the plaza to Sunset Roasters Café in the Commercial District.',
    objectiveText: 'Reach Sunset Roasters Café (East Commercial Ave)',
    target: { x: 42, y: 0, z: -24 },
    targetName: 'Sunset Roasters Café',
    rewardCoins: 350,
    rewardXp: 120,
  },
  {
    id: 'mis-stadium-sprint',
    title: 'Valley Cricket Stadium Check-In',
    category: 'sports',
    description: 'Head over to the Green Valley Cricket Stadium in the Sports Complex for match registration.',
    objectiveText: 'Reach the Cricket Stadium entrance (North-East)',
    target: { x: 86, y: 0, z: -88 },
    targetName: 'Cricket Stadium',
    rewardCoins: 400,
    rewardXp: 150,
  },
  {
    id: 'mis-hospital-supply',
    title: 'Civic Hospital Medical Courier',
    category: 'delivery',
    description: 'Transport urgent clinic kits north to Green Valley Central Hospital.',
    objectiveText: 'Reach Green Valley Central Hospital (North Campus)',
    target: { x: 16, y: 0, z: -96 },
    targetName: 'Central Hospital',
    rewardCoins: 450,
    rewardXp: 160,
  },
  {
    id: 'mis-beach-resort',
    title: 'Golden Sands Pier Exploration',
    category: 'explore',
    description: 'Take a stroll or drive south-west to the Golden Sands Beach Resort wooden pier.',
    objectiveText: 'Visit the Lakeside Pier at Golden Sands Beach',
    target: { x: -48, y: 0, z: 82 },
    targetName: 'Golden Sands Beach Pier',
    rewardCoins: 380,
    rewardXp: 140,
  },
  {
    id: 'mis-airport-taxi',
    title: 'Airport SkyCab Dispatch',
    category: 'taxi',
    description: 'Report to the Green Valley Airport & Flying Taxi Station in the South-East Transport Hub.',
    objectiveText: 'Reach the SkyCab Flying Taxi Pad at Valley Airport',
    target: { x: 92, y: 0, z: 86 },
    targetName: 'SkyCab Taxi Pad',
    rewardCoins: 550,
    rewardXp: 200,
  },
  {
    id: 'mis-sunset-plots',
    title: 'Sunset Valley Land Survey',
    category: 'explore',
    description: 'Explore the wide open Sunset Valley plots west of the river bridge — ideal for building your custom home.',
    objectiveText: 'Cross the West Bridge to Sunset Valley Plots',
    target: { x: -200, y: 0, z: -40 },
    targetName: 'Sunset Valley Plots',
    rewardCoins: 520,
    rewardXp: 190,
  },
  {
    id: 'mis-highway-overlook',
    title: 'Grand Highway South Overlook',
    category: 'adventure',
    description: 'Journey down the long Emerald Grand Highway to the scenic southern overlook.',
    objectiveText: 'Reach the South Highway Overlook (0, 240)',
    target: { x: 0, y: 0, z: 240 },
    targetName: 'South Highway Overlook',
    rewardCoins: 600,
    rewardXp: 220,
  },
];

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'item-valley-latte',
    name: 'Valley Artisan Latte',
    category: 'consumable',
    price: 40,
    description: 'Restores +25 Health and keeps you energized while exploring.',
    healthRestore: 25,
  },
  {
    id: 'item-bistro-meal',
    name: 'Emerald Bistro Lunch Box',
    category: 'consumable',
    price: 85,
    description: 'Restores +50 Health with locally grown Green Valley produce.',
    healthRestore: 50,
  },
  {
    id: 'item-soccer-ball',
    name: 'Match Football',
    category: 'gear',
    price: 150,
    description: 'Official Green Valley Sports Complex match football.',
  },
  {
    id: 'item-cricket-bat',
    name: 'Willow Cricket Bat',
    category: 'gear',
    price: 220,
    description: 'Hand-finished cricket bat from the Valley Stadium Pro Shop.',
  },
  {
    id: 'item-camera',
    name: 'Panoramic Drone Cam',
    category: 'collectible',
    price: 450,
    description: 'Collector gadget for capturing scenic views across Green Valley.',
  },
  {
    id: 'item-beach-board',
    name: 'Lakeside Paddleboard',
    category: 'collectible',
    price: 380,
    description: 'Golden Sands Resort signature summer paddleboard.',
  },
];

export const NPCS: NpcDef[] = [
  {
    id: 'npc-mayor-lin',
    name: 'Mayor Lin',
    role: 'Green Valley Mayor',
    position: { x: 6, y: 0, z: 8 },
    rotY: -0.6,
    dialogue: 'Welcome to the expanded Green Valley! Earn Green Coins through Works & Rewards, build your own 3D home anywhere in the valley, or walk up to any vehicle to rent or buy it.',
    shirtColor: '#1e3a5f',
    pantsColor: '#1e293b',
    skinTone: '#e8be9e',
    hairColor: '#374151',
  },
  {
    id: 'npc-barista-maya',
    name: 'Maya',
    role: 'Sunset Café Barista',
    position: { x: 38, y: 0, z: -20 },
    rotY: -1.2,
    dialogue: 'Looking to earn Green Coins? Start a Café Barista Shift from the Works menu or acquire Sunset Roasters Café for passive payouts.',
    shirtColor: '#92400e',
    pantsColor: '#292524',
    skinTone: '#c68652',
    hairColor: '#1c1917',
  },
  {
    id: 'npc-coach-dev',
    name: 'Coach Dev',
    role: 'Stadium Director',
    position: { x: 74, y: 0, z: -76 },
    rotY: -2.2,
    dialogue: 'Welcome to the Valley Sports Complex! Help our Grounds Crew via the Works panel to earn quick Green Coins.',
    shirtColor: '#15803d',
    pantsColor: '#1f2937',
    skinTone: '#9e623d',
    hairColor: '#111827',
  },
  {
    id: 'npc-dr-sara',
    name: 'Dr. Sara',
    role: 'Chief Medical Officer',
    position: { x: 14, y: 0, z: -84 },
    rotY: 0.2,
    dialogue: 'Green Valley Central Hospital keeps everyone healthy. Let me know if you need a full health restore or want to take a Hospital Rapid Supply job!',
    shirtColor: '#f8fafc',
    pantsColor: '#334155',
    skinTone: '#f1c9a8',
    hairColor: '#5b3a29',
  },
  {
    id: 'npc-pilot-kai',
    name: 'Captain Kai',
    role: 'SkyCab Flight Lead',
    position: { x: 84, y: 0, z: 82 },
    rotY: -2.4,
    dialogue: 'Walk up to the yellow SkyCab Aero Taxi and press E to rent or unlock it! Use SPACE to soar across our huge valley and SHIFT to descend.',
    shirtColor: '#4f46e5',
    pantsColor: '#1e293b',
    skinTone: '#d9a47b',
    hairColor: '#1f2937',
  },
  {
    id: 'npc-dealer-leo',
    name: 'Leo',
    role: 'Apex Showroom Manager',
    position: { x: 52, y: 0, z: 68 },
    rotY: 2.6,
    dialogue: 'Walk right up to any vehicle in Green Valley to rent it for a drive or unlock it permanently with Green Coins. Bicycles are always free to ride!',
    shirtColor: '#991b1b',
    pantsColor: '#18181b',
    skinTone: '#e5b894',
    hairColor: '#451a03',
  },
];

export const ATM_LOCATIONS = [
  { id: 'atm-bank', name: 'Green Valley Bank ATM', position: { x: 64, y: 0, z: -32 } },
  { id: 'atm-mall', name: 'Grand Mall Atrium ATM', position: { x: 64, y: 0, z: 4 } },
  { id: 'atm-plaza', name: 'Fountain Square ATM', position: { x: -12, y: 0, z: -12 } },
];

// 7-Day Escalating Daily Login Reward Streak
export const DAILY_LOGIN_REWARDS = [
  { day: 1, coins: 200, xp: 60, label: 'Day 1 Welcome' },
  { day: 2, coins: 300, xp: 80, label: 'Day 2 Streak' },
  { day: 3, coins: 450, xp: 100, label: 'Day 3 Bonus' },
  { day: 4, coins: 600, xp: 130, label: 'Day 4 Explorer' },
  { day: 5, coins: 750, xp: 160, label: 'Day 5 VIP' },
  { day: 6, coins: 900, xp: 200, label: 'Day 6 Champion' },
  { day: 7, coins: 1200, xp: 300, label: 'Day 7 Mega Chest' },
];

// Real Showcase Ads from github.com/typixelofficial/typixel/tree/main/showcase/showcase & @typixelofficial
export const SHOWCASE_ADS: ShowcaseAdItem[] = [
  {
    id: 'ad-chamayam',
    filename: 'Chamayam.jpg',
    title: 'Chamayam Creative',
    subtitle: 'Typixel Studio Showcase • @typixelofficial',
    imageUrl: '/api/ads/image/Chamayam.jpg',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
  {
    id: 'ad-skillovia',
    filename: 'Skillovia.jpg',
    title: 'Skillovia Academy',
    subtitle: 'Brand Design by @typixel.studio',
    imageUrl: '/api/ads/image/Skillovia.jpg',
    instagramUrl: 'https://www.instagram.com/typixel.studio/',
  },
  {
    id: 'ad-yenza',
    filename: 'Yenza.jpg',
    title: 'Yenza Collection',
    subtitle: 'Featured Campaign • @typixelofficial',
    imageUrl: '/api/ads/image/Yenza.jpg',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
  {
    id: 'ad-classycoat',
    filename: 'classycoat.jpg',
    title: 'Classy Coat Studio',
    subtitle: 'Visual Identity • @typixel.studio',
    imageUrl: '/api/ads/image/classycoat.jpg',
    instagramUrl: 'https://www.instagram.com/typixel.studio/',
  },
  {
    id: 'ad-eidcrystalmart',
    filename: 'eidcrystalmart.webp',
    title: 'Crystal Mart Festive',
    subtitle: 'Typixel Creative Ad • @typixelofficial',
    imageUrl: '/api/ads/image/eidcrystalmart.webp',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
  {
    id: 'ad-eidswahwa',
    filename: 'eidswahwa.jpg',
    title: 'Swahwa Heritage',
    subtitle: 'Poster Art • @typixelofficial',
    imageUrl: '/api/ads/image/eidswahwa.jpg',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
  {
    id: 'ad-flow',
    filename: 'flow.png',
    title: 'Flow Motion Brand',
    subtitle: 'Digital Showcase • @typixel.studio',
    imageUrl: '/api/ads/image/flow.png',
    instagramUrl: 'https://www.instagram.com/typixel.studio/',
  },
  {
    id: 'ad-frost',
    filename: 'frost.jpg',
    title: 'Frost Refresh',
    subtitle: 'Product Campaign • @typixelofficial',
    imageUrl: '/api/ads/image/frost.jpg',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
  {
    id: 'ad-neic',
    filename: 'neic_poster.jpg',
    title: 'NEIC Event Poster',
    subtitle: 'Event Graphics • @typixel.studio',
    imageUrl: '/api/ads/image/neic_poster.jpg',
    instagramUrl: 'https://www.instagram.com/typixel.studio/',
  },
  {
    id: 'ad-savethedate',
    filename: 'savethedate_poster.jpg',
    title: 'Save The Date',
    subtitle: 'Wedding Invitation • @typixelofficial',
    imageUrl: '/api/ads/image/savethedate_poster.jpg',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
  {
    id: 'ad-savethedatepost',
    filename: 'savethedatepost.jpg',
    title: 'Celebration Card',
    subtitle: 'Typixel Wedding Art • @typixel.studio',
    imageUrl: '/api/ads/image/savethedatepost.jpg',
    instagramUrl: 'https://www.instagram.com/typixel.studio/',
  },
  {
    id: 'ad-vishuchamayam',
    filename: 'vishuchamayam.jpg',
    title: 'Vishu Chamayam',
    subtitle: 'Kerala Festive Showcase • @typixelofficial',
    imageUrl: '/api/ads/image/vishuchamayam.jpg',
    instagramUrl: 'https://www.instagram.com/typixelofficial/',
  },
];

// Player-Created Custom 3D Shops (Anyone can start a Tea Stall / Chaya Kada & more!)
export const CUSTOM_SHOP_PLANS: CustomShopPlan[] = [
  {
    shopType: 'tea_stall',
    label: 'Kerala Tea Stall (Chaya Kada)',
    price: 350,
    defaultAwning: '#e11d48',
    description: 'Serve steaming Samovar Masala Chai, Pazham Pori & Parotta anywhere off-road!',
    menuItems: [
      { id: 'tea-masala', name: 'Samovar Masala Chai', price: 20, healthRestore: 25, xp: 18, heldItem: 'tea' },
      { id: 'tea-pazhampori', name: 'Hot Pazham Pori', price: 30, healthRestore: 35, xp: 24, heldItem: 'snack' },
      { id: 'tea-parotta', name: 'Malabar Parotta & Curry', price: 55, healthRestore: 60, xp: 40, heldItem: 'snack' },
    ],
  },
  {
    shopType: 'juice_bar',
    label: 'Fresh Tropical Juice Bar',
    price: 450,
    defaultAwning: '#f59e0b',
    description: 'Cool Kulukki Sarbath, Mango Shake & Tender Coconut kiosk along busy avenues.',
    menuItems: [
      { id: 'juice-kulukki', name: 'Kulukki Sarbath', price: 25, healthRestore: 30, xp: 20, heldItem: 'juice' },
      { id: 'juice-mango', name: 'Alphonso Mango Shake', price: 45, healthRestore: 50, xp: 32, heldItem: 'juice' },
      { id: 'juice-tender', name: 'Chilled Tender Coconut', price: 35, healthRestore: 40, xp: 26, heldItem: 'juice' },
    ],
  },
  {
    shopType: 'bakery',
    label: 'Valley Artisan Bakery',
    price: 550,
    defaultAwning: '#ec4899',
    description: 'Warm puffs, plum cakes, and fresh croissants loved by citizens.',
    menuItems: [
      { id: 'bak-puff', name: 'Crispy Veg Puff', price: 30, healthRestore: 35, xp: 22, heldItem: 'snack' },
      { id: 'bak-cake', name: 'Rich Chocolate Pastry', price: 50, healthRestore: 55, xp: 36, heldItem: 'snack' },
      { id: 'bak-box', name: 'Celebration Sweet Box', price: 90, healthRestore: 80, xp: 60, heldItem: 'snack' },
    ],
  },
  {
    shopType: 'boutique',
    label: 'Style & Dress Boutique',
    price: 750,
    defaultAwning: '#8b5cf6',
    description: 'Festive dresses, Kasavu wear, silk scarves & accessories.',
    menuItems: [
      { id: 'btq-scarf', name: 'Golden Silk Scarf', price: 75, healthRestore: 20, xp: 55, heldItem: 'snack' },
      { id: 'btq-shades', name: 'Designer Shades', price: 110, healthRestore: 25, xp: 75, heldItem: 'snack' },
      { id: 'btq-gift', name: 'Festive Gift Hamper', price: 150, healthRestore: 40, xp: 100, heldItem: 'snack' },
    ],
  },
  {
    shopType: 'tech_shop',
    label: 'Typixel Gadgets & Studio',
    price: 900,
    defaultAwning: '#0ea5e9',
    description: 'Smartwatches, action cams & creator studio gear.',
    menuItems: [
      { id: 'tech-buds', name: 'Studio Earbuds', price: 95, healthRestore: 15, xp: 70, heldItem: 'latte' },
      { id: 'tech-watch', name: 'Valley Smart Band', price: 140, healthRestore: 30, xp: 95, heldItem: 'latte' },
      { id: 'tech-lens', name: 'Creator Pro Lens', price: 210, healthRestore: 30, xp: 140, heldItem: 'latte' },
    ],
  },
];

// Active Enterable Buildings across Green Valley (All 14 Village Hubs!)
export const ACTIVE_BUILDINGS: ActiveBuildingDef[] = [
  {
    id: 'bldg-hospital',
    name: 'Green Valley Central Hospital',
    category: 'hospital',
    doorPosition: { x: 16, y: 0, z: -86 },
    subtitle: '24/7 Medical Care, Checkups, Pharmacy & Doctor Salary Shift',
    description: 'Step inside Green Valley Central Hospital for full medical treatment, checkups, blood donation, or work a Doctor Duty Shift for salary!',
    accent: '#fb7185',
    services: [
      {
        id: 'hosp-heal',
        label: 'Full Medical Checkup & Restore',
        description: 'Instantly restores your Health to 100 HP with doctor care.',
        cost: 30,
        healthRestore: 100,
        rewardXp: 35,
      },
      {
        id: 'hosp-doctor-shift',
        label: 'Work Duty Doctor Shift (Salary)',
        description: 'Treat valley patients at Central Hospital and collect your Doctor Salary.',
        cost: 0,
        rewardCoins: 240,
        rewardXp: 85,
      },
      {
        id: 'hosp-blood',
        label: 'Community Blood Donation',
        description: 'Help Green Valley citizens and receive a thank-you reward.',
        cost: 0,
        rewardCoins: 120,
        rewardXp: 50,
      },
      {
        id: 'hosp-tonic',
        label: 'Energy & Immunity Medicine',
        description: 'Restores +60 HP and awards +45 XP.',
        cost: 40,
        healthRestore: 60,
        rewardXp: 45,
      },
    ],
  },
  {
    id: 'bldg-gym',
    name: 'Apex Fitness & Body Building Gym',
    category: 'gym',
    doorPosition: { x: 68, y: 0, z: -76 },
    subtitle: 'Body Building, Heavy Lifting & Physique Growth',
    description: 'Train with heavy weights inside Apex Gym to visibly grow your 3D body physique (Muscle Level 0–10), restore HP, and earn Fitness XP!',
    accent: '#22c55e',
    services: [
      {
        id: 'gym-bench',
        label: 'Heavy Bench Press & Arms (Build Body +1)',
        description: 'Visibly builds broader shoulders & muscular arms (+1 Muscle Level, +65 HP, +80 XP).',
        cost: 30,
        healthRestore: 65,
        rewardXp: 80,
        muscleGain: 1,
      },
      {
        id: 'gym-deadlift',
        label: 'Pro Body Building Session (Build Body +2)',
        description: 'Intense compound strength training (+2 Muscle Level, Full 100 HP, +140 XP).',
        cost: 60,
        healthRestore: 100,
        rewardXp: 140,
        muscleGain: 2,
      },
      {
        id: 'gym-trainer-shift',
        label: 'Coach New Members (Trainer Salary)',
        description: 'Spot lifters and earn a Gym Trainer salary payout.',
        cost: 0,
        rewardCoins: 185,
        rewardXp: 65,
      },
    ],
  },
  {
    id: 'bldg-park',
    name: 'Emerald Central Park & Pavilion',
    category: 'park',
    doorPosition: { x: -28, y: 0, z: 26 },
    subtitle: 'Jogging Track, Flower Gardens, Yoga & Community Hangout',
    description: 'Relax inside Green Valley’s lush central park — jog the emerald loop, enjoy morning yoga, or help clean the park for Green Coins!',
    accent: '#10b981',
    services: [
      {
        id: 'park-yoga',
        label: 'Sunrise Park Yoga & Meditation (FREE)',
        description: 'Peaceful breathing & stretch session restoring +85 HP and +55 XP.',
        cost: 0,
        healthRestore: 85,
        rewardXp: 55,
      },
      {
        id: 'park-jog',
        label: 'Cardio Park Jogging Lap (Build Stamina +1)',
        description: 'Energizing fitness run boosting vitality (+1 Muscle Level, +50 HP, +65 XP).',
        cost: 0,
        healthRestore: 50,
        rewardXp: 65,
        muscleGain: 1,
      },
      {
        id: 'park-care',
        label: 'Park Gardener Duty (Salary)',
        description: 'Water the flower beds and tend trees for a community salary.',
        cost: 0,
        rewardCoins: 145,
        rewardXp: 55,
      },
    ],
  },
  {
    id: 'bldg-ad-center',
    name: 'Green Valley Public Ad Center',
    category: 'ad_center',
    doorPosition: { x: 32, y: 0, z: 26 },
    subtitle: 'Publish Your Own Public Ads Across Green Valley',
    description: 'Spend Green Coins to publish your own public advertisement on village billboards & every player’s live ad feed!',
    accent: '#f59e0b',
    services: [
      {
        id: 'ad-open-studio',
        label: 'Open Public Ad Publisher Studio',
        description: 'Create and broadcast your own public ad across Green Valley (200 GC).',
        cost: 0,
        openPanel: 'ads',
      },
      {
        id: 'ad-promoter-shift',
        label: 'Work Street Ad Promoter Shift (Salary)',
        description: 'Distribute local flyers around Central Plaza for quick salary.',
        cost: 0,
        rewardCoins: 155,
        rewardXp: 50,
      },
    ],
  },
  {
    id: 'bldg-mall',
    name: 'Grand Valley Shopping Mall',
    category: 'mall',
    doorPosition: { x: 68, y: 0, z: -2 },
    subtitle: 'Fashion, Food Court, Electronics & Gifts',
    description: 'Browse the Grand Valley Mall concourse for dining combos, luxury gifts, and the valley marketplace.',
    accent: '#f59e0b',
    services: [
      {
        id: 'mall-food',
        label: 'Mall Food Court Combo',
        description: 'Delicious meal platter restoring +60 HP.',
        cost: 45,
        healthRestore: 60,
        rewardXp: 35,
      },
      {
        id: 'mall-gift',
        label: 'Designer Fashion Gift Box',
        description: 'Stylish mall gift bundle giving +90 XP.',
        cost: 90,
        rewardXp: 90,
      },
      {
        id: 'mall-catalog',
        label: 'Open Valley Marketplace',
        description: 'Open full item store & inventory.',
        cost: 0,
        openPanel: 'inventory',
      },
    ],
  },
  {
    id: 'bldg-bank',
    name: 'Green Valley Central Bank',
    category: 'bank',
    doorPosition: { x: 68, y: 0, z: -30 },
    subtitle: 'Savings Dividends, Green Coin Vault & Transfers',
    description: 'Collect your citizen savings interest or inspect your Green Coin wallet ledger.',
    accent: '#10b981',
    services: [
      {
        id: 'bank-dividend',
        label: 'Claim Citizen Savings Dividend',
        description: 'Collect periodic interest from Green Valley Treasury.',
        cost: 0,
        rewardCoins: 110,
        rewardXp: 30,
      },
      {
        id: 'bank-ledger',
        label: 'Open Wallet & Transaction History',
        description: 'View all earned and spent Green Coins.',
        cost: 0,
        openPanel: 'wallet',
      },
    ],
  },
  {
    id: 'bldg-school',
    name: 'Green Valley Public School',
    category: 'school',
    doorPosition: { x: -18, y: 0, z: -96 },
    subtitle: 'Classes, Quizzes & Community Tutoring',
    description: 'Attend an interactive valley class or tutor students for Green Coins & XP.',
    accent: '#38bdf8',
    services: [
      {
        id: 'school-class',
        label: 'Attend Express Learning Session',
        description: 'Boost your knowledge and earn a study stipend.',
        cost: 0,
        rewardCoins: 95,
        rewardXp: 70,
      },
      {
        id: 'school-tutor',
        label: 'Volunteer Peer Tutoring',
        description: 'Help junior students and earn bonus coins.',
        cost: 0,
        rewardCoins: 125,
        rewardXp: 85,
      },
    ],
  },
  {
    id: 'bldg-college',
    name: 'Valley Tech & Design College',
    category: 'college',
    doorPosition: { x: -24, y: 0, z: -116 },
    subtitle: 'Coding Labs, 3D Design & Grants',
    description: 'Join a Typixel design sprint or claim a student innovation grant.',
    accent: '#6366f1',
    services: [
      {
        id: 'college-lab',
        label: '3D Design & Code Workshop',
        description: 'Complete a practical lab project for coins & XP.',
        cost: 0,
        rewardCoins: 140,
        rewardXp: 95,
      },
      {
        id: 'college-grant',
        label: 'Student Innovation Grant',
        description: 'Pitch an idea to faculty for a research payout.',
        cost: 0,
        rewardCoins: 130,
        rewardXp: 80,
      },
    ],
  },
  {
    id: 'bldg-library',
    name: 'Green Valley Civic Library',
    category: 'library',
    doorPosition: { x: 12, y: 0, z: -116 },
    subtitle: 'Quiet Reading, Valley History & Research',
    description: 'Unwind in the silent reading hall or archive valley chronicles for XP.',
    accent: '#14b8a6',
    services: [
      {
        id: 'lib-read',
        label: 'Read Green Valley Almanac',
        description: 'Calm study session restoring +45 HP and +75 XP.',
        cost: 0,
        healthRestore: 45,
        rewardXp: 75,
      },
      {
        id: 'lib-archive',
        label: 'Assist Librarian Cataloging',
        description: 'Organize books for a small library stipend.',
        cost: 0,
        rewardCoins: 85,
        rewardXp: 55,
      },
    ],
  },
  {
    id: 'bldg-cinema',
    name: 'Starlight Multiplex Cinema',
    category: 'cinema',
    doorPosition: { x: 2, y: 0, z: 72 },
    subtitle: 'Evening Premieres, Popcorn & VIP Lounge',
    description: 'Catch the latest Green Valley premiere with butter popcorn and drinks!',
    accent: '#a855f7',
    services: [
      {
        id: 'cin-show',
        label: 'Watch Blockbuster Premiere',
        description: 'Enjoy a relaxing show (+50 HP, +60 XP).',
        cost: 40,
        healthRestore: 50,
        rewardXp: 60,
      },
      {
        id: 'cin-popcorn',
        label: 'Caramel Popcorn & Cold Coffee',
        description: 'Tasty cinema combo restoring +35 HP.',
        cost: 25,
        healthRestore: 35,
        rewardXp: 25,
      },
    ],
  },
  {
    id: 'bldg-ksrtc',
    name: 'KSRTC Central Bus Terminal',
    category: 'ksrtc_depot',
    doorPosition: { x: 42, y: 0, z: 82 },
    subtitle: '24/7 Full-Time Public Bus, Conductor Salary & Express Tickets',
    description: 'Board the live full-time running KSRTC Bus, sign on as the Bus Conductor to earn salary per minute & issue passenger tickets, or grab an instant express ride!',
    accent: '#dc2626',
    services: [
      {
        id: 'ksrtc-live-bus',
        label: 'Open Live KSRTC Bus & Conductor Desk',
        description: 'Board the full-time running bus, pay fare, or work as Conductor for live salary!',
        cost: 0,
        openPanel: 'transit',
      },
      {
        id: 'ksrtc-plaza',
        label: 'KSRTC Express → Central Plaza',
        description: 'Instant Super Fast ride to Fountain Square.',
        cost: 15,
        teleportTo: { x: 0, y: 0, z: 18 },
        teleportLabel: 'Central Fountain Square',
      },
      {
        id: 'ksrtc-hospital',
        label: 'KSRTC Express → Central Hospital',
        description: 'Direct bus drop at North Medical Campus.',
        cost: 15,
        teleportTo: { x: 16, y: 0, z: -82 },
        teleportLabel: 'Central Hospital',
      },
      {
        id: 'ksrtc-honeymoon',
        label: 'KSRTC Express → Lakeside Resort (FREE)',
        description: 'Complimentary scenic lakeside ride to Honeymoon Resort.',
        cost: 0,
        teleportTo: { x: -78, y: 0, z: 112 },
        teleportLabel: 'Lakeside Honeymoon Resort',
      },
    ],
  },
  {
    id: 'bldg-airport',
    name: 'Green Valley International Airport',
    category: 'airport',
    doorPosition: { x: 108, y: 0, z: 102 },
    subtitle: 'SkyCab Terminal & Valley Scenic Charters',
    description: 'Book an express helicopter charter across Green Valley or inspect the SkyCab fleet.',
    accent: '#0ea5e9',
    services: [
      {
        id: 'air-south',
        label: 'Charter Flight → South Overlook',
        description: 'Fast air transfer to Emerald Grand Highway Overlook.',
        cost: 50,
        teleportTo: { x: 0, y: 0, z: 235 },
        teleportLabel: 'South Highway Overlook',
      },
      {
        id: 'air-wedding',
        label: 'Wedding Shuttle → Wedding Mandapam (FREE)',
        description: 'Complimentary VIP arrival right outside the Royal Wedding Hall.',
        cost: 0,
        teleportTo: { x: -110, y: 0, z: -12 },
        teleportLabel: 'Wedding Mandapam',
      },
    ],
  },
  {
    id: 'bldg-wedding-hall',
    name: 'Royal Valley Wedding Mandapam',
    category: 'wedding_hall',
    doorPosition: { x: -110, y: 0, z: -20 },
    subtitle: 'Live Mingle Screen · Free Marriages & Food For Everyone',
    description: 'Watch the Giant Live Mingle Screen, auto-select couples for FREE, serve Grand Sadhya Food to ALL citizens, and enjoy a FREE Honeymoon!',
    accent: '#f43f5e',
    services: [
      {
        id: 'wed-open-mingle',
        label: 'Open Free Single-to-Mingle & Live Screen',
        description: 'See all joined names & IDs, watch live selection + Insta DPs, and marry for FREE.',
        cost: 0,
        openPanel: 'mingle',
      },
      {
        id: 'wed-sadhya',
        label: 'Grand Kerala Sadhya & Biryani Feast (FREE)',
        description: 'Complimentary full wedding banquet (+100 HP, +80 XP).',
        cost: 0,
        healthRestore: 100,
        rewardXp: 80,
      },
    ],
  },
  {
    id: 'bldg-honeymoon-resort',
    name: 'Lakeside Honeymoon Resort',
    category: 'honeymoon_resort',
    doorPosition: { x: -78, y: 0, z: 118 },
    subtitle: 'Free Romantic Lake Deck, Candlelight Dining & Honeymoon Suite',
    description: 'Complimentary newlywed getaway overlooking Emerald Lake with golden lanterns, sunset views, and luxury dining — 100% FREE.',
    accent: '#ec4899',
    services: [
      {
        id: 'hm-suite',
        label: 'Open Free Honeymoon & Mingle Suite',
        description: 'Start your complimentary romantic honeymoon experience with your partner.',
        cost: 0,
        openPanel: 'mingle',
      },
      {
        id: 'hm-dinner',
        label: 'Candlelight Lakeside Dinner (FREE)',
        description: 'Complimentary gourmet sunset dinner restoring +100 HP & +95 XP.',
        cost: 0,
        healthRestore: 100,
        rewardXp: 95,
        heldItem: 'tea',
      },
    ],
  },
  {
    id: 'bldg-govt',
    name: 'Green Valley Government Services Hall',
    category: 'government',
    doorPosition: { x: -34, y: 0, z: -56 },
    subtitle: 'Panchayat, Passport, Driving License, Police, Land Registry & Welfare',
    description: 'Complete all official Green Valley civic & government services: Citizen ID & Passport, Driving License, Land Registry, Utility Bills, Police Aid & Public Pension.',
    accent: '#0ea5e9',
    services: [
      {
        id: 'govt-passport',
        label: 'Apply Citizen ID & Valley Passport',
        description: 'Official biometric citizen registration (+90 XP, verified citizen badge).',
        cost: 40,
        rewardXp: 90,
      },
      {
        id: 'govt-license',
        label: 'Driving License & KSRTC Permit',
        description: 'Issue official heavy & light motor driving license (+85 XP).',
        cost: 50,
        rewardXp: 85,
      },
      {
        id: 'govt-registry',
        label: 'Land & Property Deed Registration',
        description: 'Register homes & commercial shops at the Sub-Registrar Desk (+75 XP).',
        cost: 35,
        rewardXp: 75,
      },
      {
        id: 'govt-welfare',
        label: 'Collect Public Welfare Pension & Aid',
        description: 'Citizen welfare grant from Green Valley Panchayat (+160 GC, +40 XP).',
        cost: 0,
        rewardCoins: 160,
        rewardXp: 40,
      },
      {
        id: 'govt-police',
        label: 'Civic Police & Emergency Aid Desk',
        description: 'Safety briefing & emergency first-aid kit (+50 HP, +45 XP).',
        cost: 0,
        healthRestore: 50,
        rewardXp: 45,
      },
      {
        id: 'govt-utility',
        label: 'Electricity & Water Utility Clearance',
        description: 'Clear municipal utility dues and earn clean-city bonus (+55 XP).',
        cost: 20,
        rewardXp: 55,
      },
    ],
  },
  {
    id: 'bldg-game-center',
    name: 'Typixel Grand Game Center (50+ Games)',
    category: 'game_center',
    doorPosition: { x: 34, y: 0, z: 54 },
    subtitle: '54 Playable Arcade, Reflex, Puzzle & Strategy Games · VIP Entrance Card Required',
    description: 'The ultimate mega arcade! Find the hidden VIP Entrance Card at the high-risk cliff to unlock entry and play 50+ games at super cheap rates (5–15 GC).',
    accent: '#a855f7',
    services: [
      {
        id: 'gc-enter',
        label: 'Enter Grand Game Center Lobby (50+ Games)',
        description: 'Requires Hidden VIP Entrance Card. Play 54 mini-games at cheap 5–15 GC rates!',
        cost: 0,
        openPanel: 'game_center',
      },
    ],
  },
  {
    id: 'bldg-chaya-plaza',
    name: 'Central Plaza Samovar Tea Stall',
    category: 'mall',
    doorPosition: { x: -20, y: 0, z: -18 },
    subtitle: '24/7 Active Public Tea Stall · Hold & Drink Hot Chai in Hand!',
    description: 'Order hot Kerala Samovar Masala Chai, Sulaimani, or Pazham Pori — visibly hold and drink it right in your 3D character hand!',
    accent: '#f97316',
    services: [
      {
        id: 'plaza-chai',
        label: 'Hot Samovar Masala Chai (Drink in Hand)',
        description: 'Hold & sip steaming chai in your hand (+30 HP, +20 XP).',
        cost: 15,
        healthRestore: 30,
        rewardXp: 20,
        heldItem: 'tea',
      },
      {
        id: 'plaza-latte',
        label: 'Iced Valley Filter Coffee (Drink in Hand)',
        description: 'Refresh with filter coffee in hand (+35 HP, +25 XP).',
        cost: 25,
        healthRestore: 35,
        rewardXp: 25,
        heldItem: 'latte',
      },
      {
        id: 'plaza-juice',
        label: 'Fresh Kulukki Sarbath (Drink in Hand)',
        description: 'Chilled spiced lime sarbath (+40 HP, +25 XP).',
        cost: 20,
        healthRestore: 40,
        rewardXp: 25,
        heldItem: 'juice',
      },
      {
        id: 'plaza-snack',
        label: 'Hot Pazham Pori & Samosa Plate (Eat in Hand)',
        description: 'Crispy evening snacks (+45 HP, +30 XP).',
        cost: 30,
        healthRestore: 45,
        rewardXp: 30,
        heldItem: 'snack',
      },
    ],
  },
];

// 54 Playable Mini-Games inside the Grand Game Center (Cheap 5–15 GC entry, fair prizes!)
export const GAME_CENTER_GAMES: MiniGameDef[] = [
  // Reflex (6)
  { id: 'gc-01', title: 'Lightning Tap Sprint', category: 'Reflex', engine: 'reflex', entryFee: 5, winPrize: 25, tagline: 'React the instant the light turns emerald!', accent: '#10b981' },
  { id: 'gc-02', title: 'Neon Laser Dodge', category: 'Reflex', engine: 'reflex', entryFee: 6, winPrize: 28, tagline: 'Hit the shield before the neon beam fires.', accent: '#06b6d4' },
  { id: 'gc-03', title: 'KSRTC Brake Check', category: 'Reflex', engine: 'reflex', entryFee: 5, winPrize: 24, tagline: 'Slam the bus brakes at the green signal!', accent: '#ef4444' },
  { id: 'gc-04', title: 'Samovar Tea Catch', category: 'Reflex', engine: 'reflex', entryFee: 5, winPrize: 25, tagline: 'Catch the meter-pour chai on time.', accent: '#f59e0b' },
  { id: 'gc-05', title: 'Thunderbolt Trigger', category: 'Reflex', engine: 'reflex', entryFee: 8, winPrize: 34, tagline: 'Sub-350ms reflex showdown.', accent: '#8b5cf6' },
  { id: 'gc-06', title: 'SkyCab Runway Launch', category: 'Reflex', engine: 'reflex', entryFee: 7, winPrize: 30, tagline: 'Engage thrusters the moment clearance flashes.', accent: '#facc15' },
  // Timing (6)
  { id: 'gc-07', title: 'Precision Bar Lock', category: 'Arcade', engine: 'timing', entryFee: 5, winPrize: 26, tagline: 'Stop the moving needle inside the golden zone.', accent: '#f59e0b' },
  { id: 'gc-08', title: 'Penalty Kick Meter', category: 'Sports', engine: 'timing', entryFee: 8, winPrize: 36, tagline: 'Time your football power bar for top-corner goal!', accent: '#22c55e' },
  { id: 'gc-09', title: 'Volleyball Spike Timing', category: 'Sports', engine: 'timing', entryFee: 8, winPrize: 36, tagline: 'Smash the volley right at peak height.', accent: '#38bdf8' },
  { id: 'gc-10', title: 'Cricket Sixer Sweetspot', category: 'Sports', engine: 'timing', entryFee: 8, winPrize: 38, tagline: 'Swing the bat right on the green pitch mark.', accent: '#10b981' },
  { id: 'gc-11', title: 'Safe Cracker Dial', category: 'Arcade', engine: 'timing', entryFee: 10, winPrize: 42, tagline: 'Lock the vault tumbler at dead center.', accent: '#eab308' },
  { id: 'gc-12', title: 'Archery Bullseye Pulse', category: 'Sports', engine: 'timing', entryFee: 7, winPrize: 32, tagline: 'Release the bowstring at maximum steadiness.', accent: '#fb7185' },
  // Math (6)
  { id: 'gc-13', title: 'Turbo Arithmetic Blitz', category: 'Math', engine: 'math', entryFee: 5, winPrize: 26, tagline: 'Solve 3 rapid-fire equations to win!', accent: '#38bdf8' },
  { id: 'gc-14', title: 'Green Coin Cashier', category: 'Math', engine: 'math', entryFee: 5, winPrize: 25, tagline: 'Calculate exact change for village shoppers.', accent: '#10b981' },
  { id: 'gc-15', title: 'Rocket Fuel Calculator', category: 'Math', engine: 'math', entryFee: 8, winPrize: 36, tagline: 'Compute propulsion numbers before liftoff.', accent: '#6366f1' },
  { id: 'gc-16', title: 'Multiplier Madness', category: 'Math', engine: 'math', entryFee: 7, winPrize: 32, tagline: 'Fast mental multiplication challenge.', accent: '#ec4899' },
  { id: 'gc-17', title: 'Bank Vault Equations', category: 'Math', engine: 'math', entryFee: 9, winPrize: 40, tagline: 'Crack 3 numeric security sums.', accent: '#14b8a6' },
  { id: 'gc-18', title: 'Quantum Sum Duel', category: 'Math', engine: 'math', entryFee: 10, winPrize: 45, tagline: 'High-speed brain math arena.', accent: '#a855f7' },
  // Memory (6)
  { id: 'gc-19', title: 'Emerald Card Flip', category: 'Memory', engine: 'memory', entryFee: 6, winPrize: 30, tagline: 'Match all 6 hidden icon pairs in 14 moves.', accent: '#10b981' },
  { id: 'gc-20', title: 'Fruit Market Memory', category: 'Memory', engine: 'memory', entryFee: 5, winPrize: 26, tagline: 'Pair matching tropical fruits cleanly.', accent: '#f97316' },
  { id: 'gc-21', title: 'Neon Cyber Pairs', category: 'Memory', engine: 'memory', entryFee: 7, winPrize: 34, tagline: 'Decode matching arcade symbols.', accent: '#06b6d4' },
  { id: 'gc-22', title: 'Royal Palace Jewels', category: 'Memory', engine: 'memory', entryFee: 8, winPrize: 38, tagline: 'Uncover paired crowns & gems.', accent: '#eab308' },
  { id: 'gc-23', title: 'Stadium Trophy Match', category: 'Memory', engine: 'memory', entryFee: 6, winPrize: 30, tagline: 'Match sports gear pairs before tries run out.', accent: '#22c55e' },
  { id: 'gc-24', title: 'Kerala Snacks Match', category: 'Memory', engine: 'memory', entryFee: 5, winPrize: 25, tagline: 'Pair chai, banana chips & snacks!', accent: '#e11d48' },
  // Clicker / Tycoon (6)
  { id: 'gc-25', title: 'Chai Pour Frenzy', category: 'Tycoon', engine: 'clicker', entryFee: 5, winPrize: 26, tagline: 'Pour 20 cups of Masala Chai in 8 seconds!', accent: '#f97316' },
  { id: 'gc-26', title: 'Gold Coin Miner', category: 'Tycoon', engine: 'clicker', entryFee: 6, winPrize: 30, tagline: 'Tap fast to excavate 22 crystal coins!', accent: '#f59e0b' },
  { id: 'gc-27', title: 'Turbo Gym Reps', category: 'Sports', engine: 'clicker', entryFee: 6, winPrize: 28, tagline: 'Complete 20 bench-press reps before the buzzer!', accent: '#22c55e' },
  { id: 'gc-28', title: 'Pixel Art Printer', category: 'Tycoon', engine: 'clicker', entryFee: 7, winPrize: 32, tagline: 'Render 22 Typixel posters before deadline.', accent: '#ec4899' },
  { id: 'gc-29', title: 'Coconut Harvest Tap', category: 'Tycoon', engine: 'clicker', entryFee: 5, winPrize: 24, tagline: 'Harvest 18 coconuts in 8 seconds!', accent: '#10b981' },
  { id: 'gc-30', title: 'Bus Ticket Stamper', category: 'Arcade', engine: 'clicker', entryFee: 5, winPrize: 26, tagline: 'Stamp 20 KSRTC tickets at rush hour!', accent: '#dc2626' },
  // Trivia (6)
  { id: 'gc-31', title: 'Green Valley Quiz', category: 'Trivia', engine: 'trivia', entryFee: 5, winPrize: 28, tagline: 'Answer 2 rapid knowledge questions correctly.', accent: '#38bdf8' },
  { id: 'gc-32', title: 'World Geography Dash', category: 'Trivia', engine: 'trivia', entryFee: 6, winPrize: 30, tagline: 'Test your capitals & continents knowledge.', accent: '#10b981' },
  { id: 'gc-33', title: 'Tech & Design Trivia', category: 'Trivia', engine: 'trivia', entryFee: 7, winPrize: 34, tagline: 'Questions for creators & engineers.', accent: '#8b5cf6' },
  { id: 'gc-34', title: 'Football World Cup Quiz', category: 'Sports', engine: 'trivia', entryFee: 6, winPrize: 32, tagline: 'Prove your football legend knowledge.', accent: '#22c55e' },
  { id: 'gc-35', title: 'Space & Science Quest', category: 'Trivia', engine: 'trivia', entryFee: 7, winPrize: 34, tagline: 'Planets, physics, and cosmic facts.', accent: '#6366f1' },
  { id: 'gc-36', title: 'Kerala Heritage Trivia', category: 'Trivia', engine: 'trivia', entryFee: 5, winPrize: 28, tagline: 'Festivals, backwaters & local culture.', accent: '#f59e0b' },
  // Strategy RPS (5)
  { id: 'gc-37', title: 'Rock Paper Scissors Pro', category: 'Strategy', engine: 'rps', entryFee: 5, winPrize: 24, tagline: 'Outsmart the arcade bot in Best-of-3!', accent: '#fb7185' },
  { id: 'gc-38', title: 'Elemental Clash', category: 'Strategy', engine: 'rps', entryFee: 8, winPrize: 36, tagline: 'Fire, Water, Forest tactical duel.', accent: '#f97316' },
  { id: 'gc-39', title: 'Knight Archer Mage', category: 'Strategy', engine: 'rps', entryFee: 9, winPrize: 40, tagline: 'Classic medieval triad battle.', accent: '#8b5cf6' },
  { id: 'gc-40', title: 'Cyber Firewall Duel', category: 'Strategy', engine: 'rps', entryFee: 10, winPrize: 42, tagline: 'Shield, Hack, or Patch to victory.', accent: '#06b6d4' },
  { id: 'gc-41', title: 'Street Fighter Read', category: 'Arcade', engine: 'rps', entryFee: 7, winPrize: 32, tagline: 'Strike, Block, or Throw — read the AI!', accent: '#ef4444' },
  // Number Guess / Strategy (5)
  { id: 'gc-42', title: 'Vault Code Hunter', category: 'Strategy', engine: 'guess', entryFee: 5, winPrize: 30, tagline: 'Find the secret number (1–20) in 4 tries.', accent: '#10b981' },
  { id: 'gc-43', title: 'Treasure Depth Radar', category: 'Arcade', engine: 'guess', entryFee: 6, winPrize: 32, tagline: 'Pinpoint the submerged chest depth.', accent: '#0ea5e9' },
  { id: 'gc-44', title: 'Pin Code Hacker', category: 'Strategy', engine: 'guess', entryFee: 8, winPrize: 38, tagline: 'Use High/Low clues to crack the code.', accent: '#a855f7' },
  { id: 'gc-45', title: 'Crystal Compass Guess', category: 'Arcade', engine: 'guess', entryFee: 7, winPrize: 34, tagline: 'Locate the hidden ridge coordinate.', accent: '#f59e0b' },
  { id: 'gc-46', title: 'Mystery Box Oracle', category: 'Dice & Cards', engine: 'guess', entryFee: 10, winPrize: 45, tagline: 'Deduce the lucky box number in 4 shots.', accent: '#ec4899' },
  // Word Scramble (4)
  { id: 'gc-47', title: 'Typixel Word Scramble', category: 'Word', engine: 'word', entryFee: 5, winPrize: 28, tagline: 'Unscramble the hidden village word!', accent: '#14b8a6' },
  { id: 'gc-48', title: 'Neon Anagram Rush', category: 'Word', engine: 'word', entryFee: 6, winPrize: 32, tagline: 'Decode the jumbled letters fast.', accent: '#8b5cf6' },
  { id: 'gc-49', title: 'Travel City Jumble', category: 'Word', engine: 'word', entryFee: 7, winPrize: 34, tagline: 'Unscramble famous world landmarks.', accent: '#38bdf8' },
  { id: 'gc-50', title: 'Sports Star Letters', category: 'Word', engine: 'word', entryFee: 6, winPrize: 30, tagline: 'Solve the athletic vocabulary scramble.', accent: '#22c55e' },
  // Dice & Cards (4)
  { id: 'gc-51', title: 'High-Low Twin Dice', category: 'Dice & Cards', engine: 'dice', entryFee: 8, winPrize: 34, tagline: 'Predict whether twin dice roll High (8–12) or Low (2–6)!', accent: '#f59e0b' },
  { id: 'gc-52', title: 'Golden Seven Roll', category: 'Dice & Cards', engine: 'dice', entryFee: 10, winPrize: 46, tagline: 'Call your dice range and double up!', accent: '#eab308' },
  { id: 'gc-53', title: 'Emerald Card Draw', category: 'Dice & Cards', engine: 'dice', entryFee: 9, winPrize: 38, tagline: 'Predict High or Low on the casino deck.', accent: '#10b981' },
  { id: 'gc-54', title: 'Royal Villa Lucky Dice', category: 'Dice & Cards', engine: 'dice', entryFee: 15, winPrize: 65, tagline: 'VIP high-roller dice showdown at cheap rates!', accent: '#ec4899' },
];

// Single-to-Mingle Wedding Feast Menu & Hourly Matchmaking Venues
export const WEDDING_FEAST_MENU = [
  { id: 'feast-sadhya', name: 'Royal Kerala Sadhya (26 Dishes)', emoji: '🍌', hp: 100, desc: 'Served fresh on golden banana leaves with crispy pappadam & avial.' },
  { id: 'feast-biryani', name: 'Malabar Dum Biryani', emoji: '🍛', hp: 90, desc: 'Fragrant Jeerakasala rice with saffron, roasted cashews & raita.' },
  { id: 'feast-payasam', name: 'Palada & Ada Pradhaman Payasam', emoji: '🍮', hp: 60, desc: 'Rich slow-simmered traditional wedding dessert.' },
  { id: 'feast-cake', name: 'Three-Tier Royal Wedding Cake', emoji: '🎂', hp: 70, desc: 'Vanilla almond sponge frosted with edible gold petals.' },
  { id: 'feast-sulaimani', name: 'Spiced Mint Sulaimani Chai', emoji: '☕', hp: 40, desc: 'Aromatic cardamom & lemon celebratory tea.' },
];

export const MINGLE_MEETUP_LOCATIONS: { name: string; pos: Vec3 }[] = [
  { name: 'Royal Wedding Mandapam Courtyard', pos: { x: -110, y: 0, z: -14 } },
  { name: 'Central Fountain Rose Square', pos: { x: 0, y: 0, z: 12 } },
  { name: 'Lakeside Honeymoon Sunset Deck', pos: { x: -78, y: 0, z: 114 } },
  { name: 'Golden Sands Beach Gazebo', pos: { x: -46, y: 0, z: 82 } },
];

export interface ValleySingleNpc {
  uid: string;
  name: string;
  instagram: string;
  gender: Gender;
  age: number;
  skinTone: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'bob' | 'ponytail' | 'braids' | 'fade' | 'curly';
  hairColor: string;
  shirtStyle: 'tee' | 'jacket' | 'hoodie' | 'polo' | 'shirt' | 'mundu' | 'dress' | 'kurti' | 'lehenga';
  shirtColor: string;
}

export const VALLEY_SINGLES: ValleySingleNpc[] = [
  { uid: 'npc-single-ananya', name: 'Ananya Nair', instagram: 'ananya.valley', gender: 'female', age: 23, skinTone: '#e8be9e', hairStyle: 'long', hairColor: '#1c1917', shirtStyle: 'lehenga', shirtColor: '#e11d48' },
  { uid: 'npc-single-meera', name: 'Meera Menon', instagram: 'meera.greenvalley', gender: 'female', age: 25, skinTone: '#d49d73', hairStyle: 'braids', hairColor: '#2c221e', shirtStyle: 'kurti', shirtColor: '#7c3aed' },
  { uid: 'npc-single-diya', name: 'Diya Krishnan', instagram: 'diya.studio', gender: 'female', age: 22, skinTone: '#f5d6c3', hairStyle: 'ponytail', hairColor: '#4a3123', shirtStyle: 'dress', shirtColor: '#ec4899' },
  { uid: 'npc-single-arjun', name: 'Arjun Varma', instagram: 'arjun.valley', gender: 'male', age: 24, skinTone: '#d49d73', hairStyle: 'fade', hairColor: '#1c1917', shirtStyle: 'mundu', shirtColor: '#1f7a5c' },
  { uid: 'npc-single-rohan', name: 'Rohan Kurian', instagram: 'rohan.rides', gender: 'male', age: 26, skinTone: '#b5784c', hairStyle: 'curly', hairColor: '#1c1917', shirtStyle: 'jacket', shirtColor: '#2563eb' },
  { uid: 'npc-single-karthik', name: 'Karthik Das', instagram: 'karthik.lens', gender: 'male', age: 23, skinTone: '#e8be9e', hairStyle: 'short', hairColor: '#4a3123', shirtStyle: 'shirt', shirtColor: '#d97706' },
];


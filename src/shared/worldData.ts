import type {
  BusinessDef,
  CustomHomePlan,
  DistrictId,
  MissionDef,
  NpcDef,
  PropertyDef,
  RewardDef,
  ShopItemDef,
  VehicleState,
  WorkJobDef,
} from './types.ts';

// Expansive 840m x 840m "Long Place" Open World with long scenic highways and residential plots
export const WORLD_HALF_SIZE = 420;
export const WORLD_SPAWN = { x: 0, y: 0, z: 16 };

/**
 * Deterministic terrain elevation shared by Three.js terrain mesh, physics, and server.
 * Extended flat valley core (radius 330m) supports long scenic highways and custom home plots.
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

  // Wide playable valley floor across the long highway & buildable plots
  if (distFromCenter < 335) {
    return 0;
  }

  // Rolling alpine foothills rising naturally toward the mountain perimeter
  const rimT = Math.min(1, (distFromCenter - 335) / 120);
  const hillNoise =
    Math.sin(x * 0.022) * Math.cos(z * 0.02) * 7.0 +
    Math.sin((x + z) * 0.015) * 5.0 +
    15;
  return rimT * rimT * hillNoise;
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
    label: 'Cozy Timber Cabin',
    price: 500,
    size: { x: 9, y: 5.8, z: 8 },
    defaultPool: false,
    description: 'Warm wood-and-stone starter home with pitched roof and garden yard.',
  },
  {
    style: 'modern',
    label: 'Modern Family House',
    price: 1100,
    size: { x: 12, y: 7.4, z: 10 },
    defaultPool: false,
    description: 'Clean contemporary two-floor residence with panoramic windows.',
  },
  {
    style: 'villa',
    label: 'Luxury Pool Villa',
    price: 1900,
    size: { x: 14.5, y: 8.8, z: 11.5 },
    defaultPool: true,
    description: 'Spacious architectural villa complete with private turquoise pool deck.',
  },
  {
    style: 'manor',
    label: 'Grand Valley Manor',
    price: 3000,
    size: { x: 17.5, y: 11.2, z: 13.5 },
    defaultPool: true,
    description: 'Flagship multi-story estate with pool, terrace, and signature presence.',
  },
];

export const PROPERTIES: PropertyDef[] = [
  {
    id: 'prop-timber-cottage',
    name: 'Pine Timber Cottage',
    category: 'cottage',
    district: 'residential',
    price: 600,
    position: { x: -48, y: 0, z: -36 },
    doorPosition: { x: -48, y: 0, z: -29.5 },
    size: { x: 10, y: 6.5, z: 9 },
    color: '#d6c3a5',
    roofColor: '#5c4033',
    description: 'Cozy stone-and-timber cottage overlooking the central lane with a sunlit front garden.',
  },
  {
    id: 'prop-maple-bungalow',
    name: 'Maple Garden Bungalow',
    category: 'cottage',
    district: 'residential',
    price: 850,
    position: { x: -74, y: 0, z: -36 },
    doorPosition: { x: -74, y: 0, z: -29.5 },
    size: { x: 11, y: 6.8, z: 9.5 },
    color: '#e8dfd1',
    roofColor: '#3f5163',
    description: 'Bright modern bungalow surrounded by maple trees and paved parking.',
  },
  {
    id: 'prop-lakeview-villa',
    name: 'Lakeview Pool Villa',
    category: 'villa',
    district: 'residential',
    price: 1400,
    position: { x: -56, y: 0, z: -70 },
    doorPosition: { x: -56, y: 0, z: -62.5 },
    size: { x: 14, y: 8.5, z: 11 },
    color: '#f2f0eb',
    roofColor: '#2c3e50',
    hasPool: true,
    description: 'Two-story luxury villa with private turquoise swimming pool and terrace lounge.',
  },
  {
    id: 'prop-hillside-manor',
    name: 'Emerald Hillside Manor',
    category: 'manor',
    district: 'residential',
    price: 2200,
    position: { x: -88, y: 0, z: -72 },
    doorPosition: { x: -88, y: 0, z: -64 },
    size: { x: 16, y: 9.5, z: 12 },
    color: '#ece6da',
    roofColor: '#3d4c41',
    hasPool: true,
    description: 'Flagship Green Valley estate with dual terraces, pool deck, and panoramic mountain views.',
  },
  {
    id: 'prop-skyline-apt',
    name: 'Oakwood Modern Loft',
    category: 'apartment',
    district: 'residential',
    price: 1100,
    position: { x: -46, y: 0, z: -102 },
    doorPosition: { x: -46, y: 0, z: -94 },
    size: { x: 14, y: 13.5, z: 11 },
    color: '#dce3e8',
    roofColor: '#27313d',
    description: 'Contemporary apartment residence with floor-to-ceiling glass balconies.',
  },
  {
    id: 'prop-lakeside-retreat',
    name: 'Lakeside Pier Retreat',
    category: 'villa',
    district: 'entertainment',
    price: 1650,
    position: { x: -54, y: 0, z: 42 },
    doorPosition: { x: -54, y: 0, z: 35.5 },
    size: { x: 12, y: 7.5, z: 10 },
    color: '#e9dec8',
    roofColor: '#485a68',
    hasPool: true,
    description: 'Waterfront getaway steps from Golden Sands Beach and the sailboat dock.',
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
    id: 'veh-ridge-suv',
    name: 'Valley Ridge SUV',
    kind: 'suv',
    color: '#3b82f6',
    x: 48,
    y: 0,
    z: 8,
    rotY: Math.PI,
    speed: 0,
    driverUid: null,
    maxSpeed: 30,
    accel: 17,
    turnSpeed: 2.0,
    canFly: false,
    rentPrice: 75,
    buyPrice: 950,
  },
  {
    id: 'veh-apex-gt',
    name: 'Apex GT Coupe',
    kind: 'sports',
    color: '#ef4444',
    x: 56,
    y: 0,
    z: 74,
    rotY: -Math.PI * 0.25,
    speed: 0,
    driverUid: null,
    maxSpeed: 46,
    accel: 28,
    turnSpeed: 2.5,
    canFly: false,
    rentPrice: 120,
    buyPrice: 1750,
  },
  {
    id: 'veh-skycab-1',
    name: 'SkyCab Aero Taxi',
    kind: 'flying_taxi',
    color: '#facc15',
    x: 92,
    y: 0,
    z: 86,
    rotY: -Math.PI * 0.5,
    speed: 0,
    driverUid: null,
    maxSpeed: 48,
    accel: 25,
    turnSpeed: 2.2,
    canFly: true,
    rentPrice: 150,
    buyPrice: 2400,
  },
  {
    id: 'veh-breeze-ev',
    name: 'Breeze Highway EV',
    kind: 'electric',
    color: '#e2e8f0',
    x: 12,
    y: 0,
    z: 185,
    rotY: 0,
    speed: 0,
    driverUid: null,
    maxSpeed: 32,
    accel: 19,
    turnSpeed: 2.3,
    canFly: false,
    rentPrice: 50,
    buyPrice: 600,
  },
  {
    id: 'veh-cruiser-2',
    name: 'Sunset Moto Cruiser',
    kind: 'motorcycle',
    color: '#ec4899',
    x: -170,
    y: 0,
    z: -12,
    rotY: Math.PI * 0.5,
    speed: 0,
    driverUid: null,
    maxSpeed: 35,
    accel: 23,
    turnSpeed: 2.8,
    canFly: false,
    rentPrice: 55,
    buyPrice: 680,
  },
];

export const WORK_JOBS: WorkJobDef[] = [
  {
    id: 'work-plaza-courier',
    title: 'Valley Express Courier',
    role: 'Delivery Runner',
    district: 'plaza',
    payout: 180,
    xp: 60,
    cooldownSec: 25,
    station: { x: 4, y: 0, z: 12 },
    target: { x: 42, y: 0, z: -24 },
    targetName: 'Sunset Roasters Café',
    description: 'Walk or drive an express parcel from Central Fountain Square to Sunset Roasters Café.',
  },
  {
    id: 'work-cafe-barista',
    title: 'Sunset Café Morning Shift',
    role: 'Barista',
    district: 'commercial',
    payout: 160,
    xp: 55,
    cooldownSec: 25,
    station: { x: 38, y: 0, z: -20 },
    target: { x: 70, y: 0, z: -2 },
    targetName: 'Grand Valley Mall Atrium',
    description: 'Deliver warm espresso trays to staff at Grand Valley Shopping Mall.',
  },
  {
    id: 'work-hospital-medic',
    title: 'Hospital Rapid Supply',
    role: 'Clinic Assistant',
    district: 'education_health',
    payout: 230,
    xp: 80,
    cooldownSec: 30,
    station: { x: 16, y: 0, z: -86 },
    target: { x: -18, y: 0, z: -96 },
    targetName: 'Green Valley School Nurse',
    description: 'Bring first-aid supply kits from Central Hospital to Green Valley School.',
  },
  {
    id: 'work-stadium-crew',
    title: 'Stadium Match Preparation',
    role: 'Grounds Crew',
    district: 'sports',
    payout: 210,
    xp: 75,
    cooldownSec: 30,
    station: { x: 74, y: 0, z: -76 },
    target: { x: 92, y: 0, z: -96 },
    targetName: 'Cricket Stadium Pitch',
    description: 'Inspect the cricket pitch and deliver match gear at Valley Sports Complex.',
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
    payout: 340,
    xp: 120,
    cooldownSec: 40,
    station: { x: 0, y: 0, z: 24 },
    target: { x: 0, y: 0, z: 240 },
    targetName: 'South Highway Overlook',
    description: 'Long-distance haul down the scenic Emerald Grand Highway for top Green Coins pay.',
  },
];

export const REWARDS: RewardDef[] = [
  {
    id: 'rew-daily-checkin',
    title: 'Daily Green Valley Check-In',
    description: 'Claim your resident stipend every 10 minutes of active play.',
    coins: 300,
    xp: 90,
    repeatableSec: 600,
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

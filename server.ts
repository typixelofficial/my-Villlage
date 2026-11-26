import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import type {
  AnimationState,
  CharacterAppearance,
  ChatMessage,
  CustomHomeDef,
  CustomHomeStyle,
  CustomShopDef,
  CustomShopType,
  EmoteType,
  GardenStyle,
  HeldItemType,
  InteriorTheme,
  MingleEventState,
  MingleParticipant,
  MingleSelectedPair,
  NetworkPlayer,
  PalaceVillaDef,
  PublicAdDef,
  PublicBusState,
  RelationshipStatus,
  ShopSizeTier,
  SportsBallState,
  TypixelUpdateAlert,
  VehicleState,
  WorldPropertyOwnership,
} from './src/shared/types.ts';
import { DEFAULT_APPEARANCE } from './src/shared/types.ts';
import {
  ACTIVE_BUILDINGS,
  BUSINESSES,
  CONDUCTOR_SALARY_PER_MIN,
  CUSTOM_HOME_PLANS,
  CUSTOM_SHOP_PLANS,
  DAILY_LOGIN_REWARDS,
  FOOTBALL_PITCH_CENTER,
  GAME_CENTER_GAMES,
  HIDDEN_CARD_POS,
  INITIAL_VEHICLES,
  MAX_WORLD_HALF_SIZE,
  MINGLE_MEETUP_LOCATIONS,
  MISSIONS,
  PALACE_VILLAS,
  PROPERTIES,
  PUBLIC_AD_PUBLISH_COST,
  PUBLIC_BUS_FARE,
  PUBLIC_BUS_ROUTE_STOPS,
  REWARDS,
  SHOP_ITEMS,
  SHOWCASE_ADS,
  VALLEY_SINGLES,
  VOLLEYBALL_COURT_CENTER,
  WEEKLY_REWARD_COOLDOWN_SEC,
  WORK_JOBS,
  WORLD_HALF_SIZE,
  WORLD_SPAWN,
  computeHouseTotalPrice,
  computeShopTotalPrice,
  groundHeightAt,
  isPositionOnRoad,
} from './src/shared/worldData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase projectId from provisioned config automatically (verifyIdToken requires no IAM)
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || '';
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    if (raw.projectId && raw.projectId !== 'remixed-project-id') {
      firebaseProjectId = raw.projectId;
    }
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp(firebaseProjectId ? { projectId: firebaseProjectId } : undefined);
const adminAuth = getAdminAuth(adminApp);

const WORLD_ROOM = 'green-valley-1';
const PORT = Number(process.env.PORT || 3000);
const BOOTSTRAPPED_ADMIN_EMAIL = 'hashimtypixel@gmail.com';
const EXTRA_ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

function isVerifiedAdminEmail(email: string | undefined, emailVerified: boolean | undefined): boolean {
  if (!email || !emailVerified) return false;
  const norm = email.trim().toLowerCase();
  return norm === BOOTSTRAPPED_ADMIN_EMAIL || EXTRA_ADMIN_EMAILS.has(norm);
}

interface ServerPlayerRecord {
  socketId: string;
  state: NetworkPlayer;
  isAdmin: boolean;
  lastMoveAt: number;
  lastChatAt: number;
  lastActionAt: number;
  lastSignalAt: number;
  voiceActive: boolean;
  voiceMuted: boolean;
  greenCoins: number;
  xp: number;
  level: number;
  age: number;
  relationshipStatus: RelationshipStatus;
  partnerName: string;
  lastDailyLoginDate: string;
  dailyLoginStreak: number;
  totalDailyLogins: number;
  muscleLevel: number;
  hasGameCenterCard: boolean;
  activeMingleMatch: MingleEventState['activeMatch'];
  ownedProperties: Set<string>;
  ownedBusinesses: Set<string>;
  ownedVehicles: Set<string>;
  completedMissions: Set<string>;
  claimedRewards: Set<string>;
  inventory: string[];
  friends: Set<string>;
  businessCooldowns: Map<string, number>;
  workCooldowns: Map<string, number>;
  buildingCooldowns: Map<string, number>;
  dailyRewardReadyAt: number;
  unlockedShopIds: Set<string>;
  visitedVillaIds: Set<string>;
  unlockedVillaIds: Set<string>;
}

const playersByUid = new Map<string, ServerPlayerRecord>();
const uidBySocketId = new Map<string, string>();
const vehiclesById = new Map<string, VehicleState>();
const worldProperties = new Map<string, WorldPropertyOwnership>();
const customHomesById = new Map<string, CustomHomeDef>();
const customShopsById = new Map<string, CustomShopDef>();
const publicAdsById = new Map<string, PublicAdDef>();

// Expandable Village Boundary (Admin can dynamically expand up to MAX_WORLD_HALF_SIZE!)
let villageHalfSize = WORLD_HALF_SIZE;

// Official Typixel Admin Alerts / Updates feed delivered to every player's Smartphone
const typixelUpdates: TypixelUpdateAlert[] = [
  {
    id: 'upd_welcome_2026',
    title: 'Welcome to Expanded Green Valley!',
    message:
      'Explore Hashim\'s Villa & Rifad\'s Villa, play Football & Volleyball, collect the Hidden VIP Card on Danger Peak Cliff for 50+ Game Center titles, and use your Smartphone for Private Calls!',
    createdAtMs: Date.now(),
    author: 'Typixel Admin',
  },
];

// Active 1-on-1 Private Phone Calls
interface ActivePhoneCall {
  callId: string;
  callerUid: string;
  calleeUid: string;
  status: 'ringing' | 'active';
  startedAtMs: number;
}
const activePhoneCalls = new Map<string, ActivePhoneCall>();

// Playable 3D Sports Balls (Football & Volleyball)
const sportsBalls: Record<'football' | 'volleyball', SportsBallState> = {
  football: {
    id: 'football',
    x: FOOTBALL_PITCH_CENTER.x,
    y: 0.42,
    z: FOOTBALL_PITCH_CENTER.z,
    vx: 0,
    vy: 0,
    vz: 0,
    scoreA: 0,
    scoreB: 0,
  },
  volleyball: {
    id: 'volleyball',
    x: VOLLEYBALL_COURT_CENTER.x,
    y: 0.36,
    z: VOLLEYBALL_COURT_CENTER.z - 3,
    vx: 0,
    vy: 0,
    vz: 0,
    scoreA: 0,
    scoreB: 0,
  },
};

// Secure Server-Side Custom Admin Passcode Store (NO hardcoded plaintext password!)
const ADMIN_USERNAME_EXPECTED = (process.env.ADMIN_USERNAME || 'typixelofficial').trim().toLowerCase();
let adminPasscodeRecord: { salt: string; hash: string } | null = null;
const adminSessionTokens = new Map<string, { username: string; expiresAt: number }>();

function hashSecretScrypt(secret: string, saltHex: string): string {
  return crypto.scryptSync(secret, saltHex, 32).toString('hex');
}

function verifySecretScrypt(secret: string, saltHex: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashSecretScrypt(secret, saltHex), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length >= 6) {
  const salt = crypto.randomBytes(16).toString('hex');
  adminPasscodeRecord = {
    salt,
    hash: hashSecretScrypt(process.env.ADMIN_PASSWORD.trim(), salt),
  };
}

function issueAdminSessionToken(username: string): string {
  const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
  adminSessionTokens.set(token, { username, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  return token;
}

function verifyAdminSessionToken(token: unknown): boolean {
  if (typeof token !== 'string' || !token.startsWith('adm_')) return false;
  const entry = adminSessionTokens.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    adminSessionTokens.delete(token);
    return false;
  }
  return true;
}

// Hashim's Villa & Rifad's Villa — Grand Walled Palace Estates
interface ServerPalaceVilla extends PalaceVillaDef {
  keySalt: string;
  keyHash: string;
}
const palaceVillasById = new Map<string, ServerPalaceVilla>();
for (const v of PALACE_VILLAS) {
  let keySalt = '';
  let keyHash = '';
  let hasKeySet = false;
  if (v.villaId === 'hashim_villa' && process.env.HASHIM_VILLA_DEFAULT_KEY?.trim()) {
    keySalt = crypto.randomBytes(16).toString('hex');
    keyHash = hashSecretScrypt(process.env.HASHIM_VILLA_DEFAULT_KEY.trim(), keySalt);
    hasKeySet = true;
  }
  palaceVillasById.set(v.villaId, {
    ...v,
    hasKeySet,
    keySalt,
    keyHash,
  });
}

function toPublicVilla(v: ServerPalaceVilla): PalaceVillaDef {
  return {
    villaId: v.villaId,
    boardName: v.boardName,
    ownerUsername: v.ownerUsername,
    ownerDisplayName: v.ownerDisplayName,
    visitFee: v.visitFee,
    hasKeySet: v.hasKeySet,
    x: v.x,
    z: v.z,
    gatePos: v.gatePos,
    doorPos: v.doorPos,
    wallSize: v.wallSize,
    accentColor: v.accentColor,
  };
}

function isVillaOwner(rec: ServerPlayerRecord, villa: ServerPalaceVilla): boolean {
  if (rec.isAdmin) return true;
  const normIg = rec.state.instagramId.trim().toLowerCase();
  const normName = rec.state.displayName.trim().toLowerCase();
  const target = villa.ownerUsername.toLowerCase();
  return normIg === target || normName === target;
}

function hashShopSecretKey(rawKey: string): string {
  return crypto.createHash('sha256').update(`gv_shop_key::${rawKey.trim()}`).digest('hex');
}

// =========================================================================
// FULL-TIME AUTONOMOUS RUNNING KSRTC PUBLIC TRANSPORT BUS
// =========================================================================
let busStopIdx = 0;
let busWaitUntilMs = Date.now() + 3000;
let busLastTickMs = Date.now();
let busLastSalaryTickMs = Date.now();

const publicBus: PublicBusState = {
  id: 'public-ksrtc-express',
  name: 'KSRTC Super Fast Public Express',
  x: PUBLIC_BUS_ROUTE_STOPS[0].x,
  y: 0,
  z: PUBLIC_BUS_ROUTE_STOPS[0].z,
  rotY: 0,
  speed: 0,
  fare: PUBLIC_BUS_FARE,
  isAtStop: true,
  currentStopName: PUBLIC_BUS_ROUTE_STOPS[0].name,
  nextStopName: PUBLIC_BUS_ROUTE_STOPS[1].name,
  conductorUid: null,
  conductorName: '',
  conductorStartedAtMs: 0,
  conductorEarnedSalary: 0,
  conductorFaresCollected: 0,
  conductorTicketsIssued: 0,
  passengers: [],
};

// In-memory cache for strictly allowlisted GitHub Showcase ad images
const adImageCache = new Map<string, { buf: Buffer; contentType: string }>();
const ALLOWED_AD_FILENAMES = new Set(SHOWCASE_ADS.map((a) => a.filename));

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSinceDateKey(dateKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return 999;
  const [y, m, d] = dateKey.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const nowDate = new Date();
  const todayUtc = Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  return Math.floor((todayUtc - then) / 86400000);
}

// Max 5-Minute Single-to-Mingle Round Timer (Admin can reset anytime!)
const MINGLE_MAX_ROUND_MS = 5 * 60 * 1000;
let mingleNextEventAtMs = Date.now() + MINGLE_MAX_ROUND_MS;
let currentMingleLocationIdx = 0;
let mingleAlarmSentForRound = 0;
const mingleJoinedAt = new Map<string, number>();
let currentSelectedPair: MingleSelectedPair | null = null;

function toMingleParticipant(rec: ServerPlayerRecord): MingleParticipant {
  return {
    uid: rec.state.uid,
    displayName: rec.state.displayName,
    instagramId: rec.state.instagramId,
    photoURL: rec.state.photoURL,
    age: rec.age,
    gender: rec.state.appearance.gender,
    relationshipStatus: rec.relationshipStatus,
    appearance: rec.state.appearance,
    joinedAt: mingleJoinedAt.get(rec.state.uid) || Date.now(),
    isOnline: true,
    isNpc: false,
  };
}

function npcToMingleParticipant(npc: (typeof VALLEY_SINGLES)[number]): MingleParticipant {
  return {
    uid: npc.uid,
    displayName: npc.name,
    instagramId: npc.instagram,
    photoURL: '',
    age: npc.age,
    gender: npc.gender,
    relationshipStatus: 'single',
    appearance: {
      gender: npc.gender,
      skinTone: npc.skinTone,
      hairStyle: npc.hairStyle,
      hairColor: npc.hairColor,
      shirtStyle: npc.shirtStyle,
      shirtColor: npc.shirtColor,
      pantsColor: npc.gender === 'female' ? '#fda4af' : '#1e293b',
      shoeColor: '#f8fafc',
      accessory: 'none',
    },
    joinedAt: Date.now(),
    isOnline: true,
    isNpc: true,
  };
}

function getJoinedMingleAccounts(): MingleParticipant[] {
  const list: MingleParticipant[] = [];
  for (const [joinedUid, joinedTs] of mingleJoinedAt.entries()) {
    const rec = playersByUid.get(joinedUid);
    if (rec) {
      list.push({ ...toMingleParticipant(rec), joinedAt: joinedTs });
    }
  }
  return list.sort((a, b) => a.joinedAt - b.joinedAt);
}

function buildMingleStateForPlayer(rec: ServerPlayerRecord): MingleEventState {
  const remainingMs = Math.max(0, mingleNextEventAtMs - Date.now());
  const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
  return {
    nextEventAtMs: mingleNextEventAtMs,
    maxRoundDurationMs: MINGLE_MAX_ROUND_MS,
    alarmActive: remainingMs <= 60 * 1000 && remainingMs > 0,
    locationName: loc.name,
    locationPos: loc.pos,
    isJoined: mingleJoinedAt.has(rec.state.uid),
    joinedAccounts: getJoinedMingleAccounts(),
    selectedPair: currentSelectedPair,
    activeMatch: rec.activeMingleMatch,
  };
}

for (const v of INITIAL_VEHICLES) {
  vehiclesById.set(v.id, { ...v });
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

function sanitizeName(raw: unknown): string {
  const cleaned = sanitizeText(raw, 24).replace(/[^a-zA-Z0-9 _\-]/g, '');
  return cleaned.length >= 2 ? cleaned : 'Valley Explorer';
}

function sanitizeHomeName(raw: unknown): string {
  const cleaned = sanitizeText(raw, 32).replace(/[^a-zA-Z0-9 _\-]/g, '');
  return cleaned.length >= 2 ? cleaned : 'Green Valley Home';
}

function sanitizeInstagram(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30);
}

const VALID_GENDERS = new Set(['male', 'female']);
const VALID_HAIRS = new Set(['short', 'long', 'spiky', 'bob', 'ponytail', 'braids', 'fade', 'curly']);
const VALID_SHIRTS = new Set(['tee', 'jacket', 'hoodie', 'polo', 'shirt', 'mundu', 'dress', 'kurti', 'lehenga']);
const VALID_ACCESSORIES = new Set(['none', 'glasses', 'cap', 'backpack', 'headphones']);
const VALID_HOME_STYLES = new Set<CustomHomeStyle>(['cabin', 'modern', 'villa', 'manor']);
const VALID_SHOP_TYPES = new Set<CustomShopType>(['tea_stall', 'juice_bar', 'bakery', 'boutique', 'tech_shop']);
const VALID_SHOP_TIERS = new Set<ShopSizeTier>(['small', 'medium', 'large', 'palace']);
const VALID_INTERIORS = new Set<InteriorTheme>(['modern', 'cozy', 'minimal', 'luxury']);
const VALID_GARDENS = new Set<GardenStyle>(['flowers', 'zen', 'poolside', 'orchard']);
const VALID_ANIMS = new Set<AnimationState>([
  'idle',
  'walk',
  'run',
  'jump',
  'drive',
  'wave',
  'dance',
  'cheer',
  'sit',
  'clap',
  'drink',
  'eat',
]);
const VALID_HELD_ITEMS = new Set<HeldItemType>([
  'none',
  'tea',
  'latte',
  'juice',
  'snack',
  'football',
  'volleyball',
  'cricket_bat',
]);
const VALID_EMOTES = new Set<EmoteType>(['wave', 'dance', 'cheer', 'sit', 'clap']);
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeAppearance(input: unknown): CharacterAppearance {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    gender: VALID_GENDERS.has(String(src.gender))
      ? (src.gender as CharacterAppearance['gender'])
      : DEFAULT_APPEARANCE.gender,
    skinTone:
      typeof src.skinTone === 'string' && HEX_RE.test(src.skinTone)
        ? src.skinTone
        : DEFAULT_APPEARANCE.skinTone,
    hairStyle: VALID_HAIRS.has(String(src.hairStyle))
      ? (src.hairStyle as CharacterAppearance['hairStyle'])
      : DEFAULT_APPEARANCE.hairStyle,
    hairColor:
      typeof src.hairColor === 'string' && HEX_RE.test(src.hairColor)
        ? src.hairColor
        : DEFAULT_APPEARANCE.hairColor,
    shirtStyle: VALID_SHIRTS.has(String(src.shirtStyle))
      ? (src.shirtStyle as CharacterAppearance['shirtStyle'])
      : DEFAULT_APPEARANCE.shirtStyle,
    shirtColor:
      typeof src.shirtColor === 'string' && HEX_RE.test(src.shirtColor)
        ? src.shirtColor
        : DEFAULT_APPEARANCE.shirtColor,
    pantsColor:
      typeof src.pantsColor === 'string' && HEX_RE.test(src.pantsColor)
        ? src.pantsColor
        : DEFAULT_APPEARANCE.pantsColor,
    shoeColor:
      typeof src.shoeColor === 'string' && HEX_RE.test(src.shoeColor)
        ? src.shoeColor
        : DEFAULT_APPEARANCE.shoeColor,
    accessory: VALID_ACCESSORIES.has(String(src.accessory))
      ? (src.accessory as CharacterAppearance['accessory'])
      : DEFAULT_APPEARANCE.accessory,
  };
}

function levelFromXp(xp: number): number {
  return Math.max(1, Math.min(100, Math.floor(xp / 250) + 1));
}

function findSafeHomeCoordinates(rawX: number, rawZ: number): { x: number; y: number; z: number } {
  let x = clamp(rawX, -WORLD_HALF_SIZE + 35, WORLD_HALF_SIZE - 35);
  let z = clamp(rawZ, -WORLD_HALF_SIZE + 35, WORLD_HALF_SIZE - 35);

  // Keep central fountain plaza & main boulevards clear
  if (Math.hypot(x, z) < 34) {
    x = x >= 0 ? 38 : -38;
    z = z >= 0 ? 34 : -34;
  }
  if (Math.abs(x) < 16) {
    x = x >= 0 ? 22 : -22;
  }
  if (Math.abs(z) < 16) {
    z = z >= 0 ? 22 : -22;
  }

  // Push out of lake basin if player tried building underwater
  if (groundHeightAt(x, z) < -0.05) {
    x = -210;
    z = -60 + (customHomesById.size % 8) * 24;
  }

  // Avoid direct overlap with existing custom homes
  for (let attempt = 0; attempt < 12; attempt++) {
    let overlaps = false;
    for (const existing of customHomesById.values()) {
      if (Math.hypot(existing.x - x, existing.z - z) < 19) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) break;
    x = clamp(x + 22 * Math.cos(attempt * 1.1), -WORLD_HALF_SIZE + 35, WORLD_HALF_SIZE - 35);
    z = clamp(z + 22 * Math.sin(attempt * 1.1), -WORLD_HALF_SIZE + 35, WORLD_HALF_SIZE - 35);
  }

  const y = Math.max(0, groundHeightAt(x, z));
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(2)), z: Number(z.toFixed(1)) };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Health & World Status API
  app.get('/api/health', (_req, res) => {
    let activeVoice = 0;
    for (const p of playersByUid.values()) {
      if (p.voiceActive) activeVoice++;
    }
    res.json({
      status: 'ok',
      world: 'GREEN VALLEY',
      room: WORLD_ROOM,
      onlinePlayers: playersByUid.size,
      activeVoiceUsers: activeVoice,
      vehiclesCount: vehiclesById.size,
      customHomesCount: customHomesById.size,
      customShopsCount: customShopsById.size,
      worldSizeMeters: WORLD_HALF_SIZE * 2,
    });
  });

  // Strictly allowlisted Typixel GitHub Showcase Ads Catalog & Image Proxy (Zero SSRF)
  app.get('/api/ads/catalog', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ ads: SHOWCASE_ADS });
  });

  app.get('/api/ads/image/:filename', async (req, res) => {
    const filename = String(req.params.filename || '');
    if (!ALLOWED_AD_FILENAMES.has(filename)) {
      res.status(404).json({ error: 'Ad image not found' });
      return;
    }
    const cached = adImageCache.get(filename);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.buf);
      return;
    }
    try {
      const upstreamUrl = `https://raw.githubusercontent.com/typixelofficial/typixel/main/showcase/showcase/${encodeURIComponent(filename)}`;
      const upstream = await fetch(upstreamUrl, {
        headers: { 'User-Agent': 'Typixel-Open-World/1.0' },
      });
      if (!upstream.ok) {
        res.status(502).json({ error: 'Upstream showcase image unavailable' });
        return;
      }
      const arrBuf = await upstream.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      const ext = filename.split('.').pop()?.toLowerCase();
      const contentType =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg';
      adImageCache.set(filename, { buf, contentType });
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(502).json({ error: 'Failed to load showcase asset' });
    }
  });

  // =========================================================================
  // Real Server-Side Instagram Follower Verification (@typixelofficial & @typixel.studio)
  // =========================================================================
  const syncedOfficialFollowers = new Set<string>(['typixelofficial', 'typixel.studio']);
  const syncedStudioFollowers = new Set<string>(['typixelofficial', 'typixel.studio']);
  const pendingFollowRequests = new Map<string, { instagramId: string; requestedAt: number }>();
  const igRateBuckets = new Map<string, { count: number; resetAt: number }>();

  const isIgRateLimited = (ip: string, limitPerMin = 25): boolean => {
    const now = Date.now();
    const cur = igRateBuckets.get(ip);
    if (!cur || now > cur.resetAt) {
      igRateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
      return false;
    }
    cur.count += 1;
    return cur.count > limitPerMin;
  };

  const isSafeExternalApiHost = (host: string): boolean => {
    const h = host.trim().toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(h) || !h.includes('.')) return false;
    if (
      h === 'localhost' ||
      h.endsWith('.local') ||
      h.startsWith('127.') ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    ) {
      return false;
    }
    return true;
  };

  const verifyAdminBearer = async (
    req: express.Request,
  ): Promise<{ uid: string; email: string } | null> => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    if (verifyAdminSessionToken(token)) {
      return { uid: 'admin_custom', email: `${ADMIN_USERNAME_EXPECTED}@typixel.admin` };
    }
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (!isVerifiedAdminEmail(decoded.email, decoded.email_verified)) return null;
      return { uid: decoded.uid, email: decoded.email || '' };
    } catch {
      return null;
    }
  };

  // =========================================================================
  // SECURE CUSTOM ADMIN LOGIN & FIRST-RUN SETUP (No hardcoded passwords!)
  // =========================================================================
  app.get('/api/admin/status', (_req, res) => {
    res.json({
      configured: Boolean(adminPasscodeRecord),
      expectedUsername: ADMIN_USERNAME_EXPECTED,
    });
  });

  app.post('/api/admin/claim', (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (isIgRateLimited(ip, 10)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
      return;
    }
    if (adminPasscodeRecord) {
      res.status(409).json({ error: 'Admin passcode is already configured. Please sign in.' });
      return;
    }
    const username = sanitizeText(req.body?.username, 32).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (username !== ADMIN_USERNAME_EXPECTED) {
      res.status(400).json({ error: `Admin username must be "${ADMIN_USERNAME_EXPECTED}".` });
      return;
    }
    if (password.length < 6 || password.length > 64) {
      res.status(400).json({ error: 'Admin password must be 6–64 characters.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    adminPasscodeRecord = { salt, hash: hashSecretScrypt(password, salt) };
    const token = issueAdminSessionToken(username);
    res.json({ ok: true, adminToken: token, username });
  });

  app.post('/api/admin/login', (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (isIgRateLimited(ip, 15)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
      return;
    }
    if (!adminPasscodeRecord) {
      res.status(400).json({ error: 'Admin passcode not yet initialized. Claim it first.' });
      return;
    }
    const username = sanitizeText(req.body?.username, 32).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (
      username !== ADMIN_USERNAME_EXPECTED ||
      !verifySecretScrypt(password, adminPasscodeRecord.salt, adminPasscodeRecord.hash)
    ) {
      res.status(401).json({ error: 'Invalid admin username or password.' });
      return;
    }
    const token = issueAdminSessionToken(username);
    res.json({ ok: true, adminToken: token, username });
  });

  const checkLiveInstagramFollowing = async (
    igUsername: string,
  ): Promise<{ followsOfficial: boolean; followsStudio: boolean } | null> => {
    const apiKey = (process.env.INSTAGRAM_VERIFY_API_KEY || '').trim();
    const apiHost = (process.env.INSTAGRAM_VERIFY_API_HOST || '').trim();
    if (!apiKey || !apiHost || !isSafeExternalApiHost(apiHost)) return null;

    try {
      const url = `https://${apiHost}/v1/following?username_or_id_or_url=${encodeURIComponent(igUsername)}`;
      const resp = await fetch(url, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': apiHost,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (!resp.ok) return null;
      const body = (await resp.json()) as {
        data?: { items?: Array<{ username?: string }> };
        items?: Array<{ username?: string }>;
      };
      const items = body?.data?.items || body?.items || [];
      const followingSet = new Set(
        items.map((it) => sanitizeInstagram(it?.username).toLowerCase()).filter(Boolean),
      );
      return {
        followsOfficial: followingSet.has('typixelofficial'),
        followsStudio: followingSet.has('typixel.studio'),
      };
    } catch {
      return null;
    }
  };

  app.post('/api/instagram/verify-follow', async (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (isIgRateLimited(ip, 30)) {
      res.status(429).json({ error: 'Too many verification checks. Wait a minute and try again.' });
      return;
    }

    const cleanIg = sanitizeInstagram(req.body?.instagramId).toLowerCase();
    if (cleanIg.length < 2) {
      res.status(400).json({ error: 'Enter a valid Instagram username (2–30 characters).' });
      return;
    }

    const liveApiConfigured = Boolean(
      (process.env.INSTAGRAM_VERIFY_API_KEY || '').trim() &&
        isSafeExternalApiHost(process.env.INSTAGRAM_VERIFY_API_HOST || ''),
    );

    let followsOfficial = syncedOfficialFollowers.has(cleanIg);
    let followsStudio = syncedStudioFollowers.has(cleanIg);
    let mode: 'live_api' | 'synced_directory' = 'synced_directory';

    if (liveApiConfigured && !(followsOfficial && followsStudio)) {
      const live = await checkLiveInstagramFollowing(cleanIg);
      if (live) {
        mode = 'live_api';
        followsOfficial = followsOfficial || live.followsOfficial;
        followsStudio = followsStudio || live.followsStudio;
        if (followsOfficial) syncedOfficialFollowers.add(cleanIg);
        if (followsStudio) syncedStudioFollowers.add(cleanIg);
      }
    }

    res.json({
      instagramId: cleanIg,
      followsOfficial,
      followsStudio,
      verified: followsOfficial && followsStudio,
      mode,
      liveApiConfigured,
    });
  });

  app.post('/api/instagram/request-verify', (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (isIgRateLimited(ip, 10)) {
      res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
      return;
    }
    const cleanIg = sanitizeInstagram(req.body?.instagramId).toLowerCase();
    if (cleanIg.length < 2) {
      res.status(400).json({ error: 'Enter a valid Instagram username.' });
      return;
    }
    if (pendingFollowRequests.size >= 200 && !pendingFollowRequests.has(cleanIg)) {
      const oldestKey = pendingFollowRequests.keys().next().value;
      if (oldestKey) pendingFollowRequests.delete(oldestKey);
    }
    pendingFollowRequests.set(cleanIg, { instagramId: cleanIg, requestedAt: Date.now() });
    res.json({ ok: true, instagramId: cleanIg });
  });

  app.get('/api/instagram/admin/state', async (req, res) => {
    const admin = await verifyAdminBearer(req);
    if (!admin) {
      res.status(403).json({ error: 'Verified admin authentication required.' });
      return;
    }
    const liveApiConfigured = Boolean(
      (process.env.INSTAGRAM_VERIFY_API_KEY || '').trim() &&
        isSafeExternalApiHost(process.env.INSTAGRAM_VERIFY_API_HOST || ''),
    );
    res.json({
      officialCount: syncedOfficialFollowers.size,
      studioCount: syncedStudioFollowers.size,
      liveApiConfigured,
      pendingRequests: Array.from(pendingFollowRequests.values()).sort(
        (a, b) => b.requestedAt - a.requestedAt,
      ),
    });
  });

  app.post('/api/instagram/admin/sync', async (req, res) => {
    const admin = await verifyAdminBearer(req);
    if (!admin) {
      res.status(403).json({ error: 'Verified admin authentication required.' });
      return;
    }
    const officialArr = Array.isArray(req.body?.official) ? req.body.official : [];
    const studioArr = Array.isArray(req.body?.studio) ? req.body.studio : [];
    const clearPending = Array.isArray(req.body?.clearPending) ? req.body.clearPending : [];

    syncedOfficialFollowers.clear();
    syncedOfficialFollowers.add('typixelofficial');
    syncedOfficialFollowers.add('typixel.studio');
    for (const raw of officialArr.slice(0, 10000)) {
      const clean = sanitizeInstagram(raw).toLowerCase();
      if (clean) syncedOfficialFollowers.add(clean);
    }

    syncedStudioFollowers.clear();
    syncedStudioFollowers.add('typixelofficial');
    syncedStudioFollowers.add('typixel.studio');
    for (const raw of studioArr.slice(0, 10000)) {
      const clean = sanitizeInstagram(raw).toLowerCase();
      if (clean) syncedStudioFollowers.add(clean);
    }

    for (const raw of clearPending) {
      const clean = sanitizeInstagram(raw).toLowerCase();
      if (clean) pendingFollowRequests.delete(clean);
    }
    for (const ig of syncedOfficialFollowers) {
      if (syncedStudioFollowers.has(ig)) pendingFollowRequests.delete(ig);
    }

    res.json({
      ok: true,
      officialCount: syncedOfficialFollowers.size,
      studioCount: syncedStudioFollowers.size,
    });
  });

  const server = http.createServer(app);

  // Restrict Socket.IO CORS to same-origin / allowed hosts (never wildcard on auth endpoints)
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        try {
          const parsed = new URL(origin);
          if (
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1' ||
            parsed.hostname.endsWith('.run.app') ||
            (process.env.APP_URL && origin === new URL(process.env.APP_URL).origin)
          ) {
            return callback(null, true);
          }
        } catch {
          // Reject malformed origin
        }
        return callback(new Error('Origin not allowed'));
      },
      credentials: true,
    },
    pingInterval: 15000,
    pingTimeout: 25000,
  });

  // Authenticate every Socket.IO handshake using real Firebase ID token verification
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length < 20) {
        return next(new Error('Authentication token required'));
      }
      const decoded = await adminAuth.verifyIdToken(token);
      if (!decoded.uid) {
        return next(new Error('Invalid Firebase ID token'));
      }
      const adminToken = socket.handshake.auth?.adminToken;
      const isAdmin =
        isVerifiedAdminEmail(decoded.email, decoded.email_verified) ||
        verifyAdminSessionToken(adminToken);

      socket.data.uid = decoded.uid;
      socket.data.email = decoded.email || '';
      socket.data.emailVerified = Boolean(decoded.email_verified);
      socket.data.googleName = decoded.name || 'Valley Explorer';
      socket.data.photoURL = decoded.picture || '';
      socket.data.isAdmin = isAdmin;
      return next();
    } catch (err) {
      console.warn('Socket auth rejected:', err instanceof Error ? err.message : String(err));
      return next(new Error('Invalid or expired sign-in session'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const uid = String(socket.data.uid);
    const verifiedPhoto = String(socket.data.photoURL || '').slice(0, 512);

    // Prevent duplicate sessions for the same authenticated UID
    const existingRecord = playersByUid.get(uid);
    if (existingRecord && existingRecord.socketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(existingRecord.socketId);
      if (oldSocket) {
        oldSocket.emit('session:replaced', {
          reason: 'Your account signed in from another session.',
        });
        oldSocket.disconnect(true);
      }
      uidBySocketId.delete(existingRecord.socketId);
      if (existingRecord.state.vehicleId) {
        const veh = vehiclesById.get(existingRecord.state.vehicleId);
        if (veh && veh.driverUid === uid) {
          veh.driverUid = null;
          veh.speed = 0;
          io.to(WORLD_ROOM).emit('vehicle:updated', veh);
        }
      }
    }

    socket.join(WORLD_ROOM);
    uidBySocketId.set(socket.id, uid);

    // Wait for player:join payload with character profile from Firestore
    socket.on('player:join', (payload: Record<string, unknown>) => {
      const displayName = sanitizeName(payload?.displayName || socket.data.googleName);
      const instagramId = sanitizeInstagram(payload?.instagramId);
      const appearance = sanitizeAppearance(payload?.appearance);

      const spawnX =
        typeof payload?.x === 'number' && Number.isFinite(payload.x)
          ? clamp(payload.x, -WORLD_HALF_SIZE + 12, WORLD_HALF_SIZE - 12)
          : WORLD_SPAWN.x + (Math.random() - 0.5) * 6;
      const spawnZ =
        typeof payload?.z === 'number' && Number.isFinite(payload.z)
          ? clamp(payload.z, -WORLD_HALF_SIZE + 12, WORLD_HALF_SIZE - 12)
          : WORLD_SPAWN.z + (Math.random() - 0.5) * 6;
      const spawnY = Math.max(0, groundHeightAt(spawnX, spawnZ));

      const initCoins =
        typeof payload?.greenCoins === 'number' && Number.isFinite(payload.greenCoins)
          ? clamp(Math.round(payload.greenCoins), 0, 10000000)
          : 1500;
      const initXp =
        typeof payload?.xp === 'number' && Number.isFinite(payload.xp)
          ? clamp(Math.round(payload.xp), 0, 1000000)
          : 0;
      const initProps = Array.isArray(payload?.ownedProperties)
        ? payload.ownedProperties.filter((p): p is string => typeof p === 'string').slice(0, 30)
        : [];
      const initBiz = Array.isArray(payload?.ownedBusinesses)
        ? payload.ownedBusinesses.filter((b): b is string => typeof b === 'string').slice(0, 10)
        : [];
      const initVehicles = Array.isArray(payload?.ownedVehicles)
        ? payload.ownedVehicles.filter((v): v is string => typeof v === 'string').slice(0, 20)
        : [];
      const initMissions = Array.isArray(payload?.completedMissions)
        ? payload.completedMissions.filter((m): m is string => typeof m === 'string').slice(0, 50)
        : [];
      const initRewards = Array.isArray(payload?.claimedRewards)
        ? payload.claimedRewards.filter((r): r is string => typeof r === 'string').slice(0, 30)
        : [];
      const initInventory = Array.isArray(payload?.inventory)
        ? payload.inventory.filter((i): i is string => typeof i === 'string').slice(0, 30)
        : [];
      const initFriends = Array.isArray(payload?.friends)
        ? payload.friends.filter((f): f is string => typeof f === 'string').slice(0, 50)
        : [];

      // Seed server property registry from known Firestore claims
      if (Array.isArray(payload?.knownProperties)) {
        for (const item of payload.knownProperties) {
          if (item && typeof item === 'object') {
            const p = item as Record<string, unknown>;
            if (typeof p.propertyId === 'string' && typeof p.ownerUid === 'string') {
              if (!worldProperties.has(p.propertyId)) {
                worldProperties.set(p.propertyId, {
                  propertyId: p.propertyId,
                  ownerUid: p.ownerUid,
                  ownerName: sanitizeName(p.ownerName),
                  interiorTheme: (VALID_INTERIORS.has(String(p.interiorTheme) as InteriorTheme)
                    ? p.interiorTheme
                    : 'modern') as InteriorTheme,
                  gardenStyle: (VALID_GARDENS.has(String(p.gardenStyle) as GardenStyle)
                    ? p.gardenStyle
                    : 'flowers') as GardenStyle,
                });
              }
            }
          }
        }
      }

      // Seed server custom homes from known Firestore customHomes
      if (Array.isArray(payload?.knownCustomHomes)) {
        for (const item of payload.knownCustomHomes) {
          if (item && typeof item === 'object') {
            const h = item as Record<string, unknown>;
            if (
              typeof h.homeId === 'string' &&
              typeof h.ownerUid === 'string' &&
              !customHomesById.has(h.homeId)
            ) {
              const style = VALID_HOME_STYLES.has(String(h.style) as CustomHomeStyle)
                ? (h.style as CustomHomeStyle)
                : 'modern';
              customHomesById.set(h.homeId, {
                homeId: h.homeId.slice(0, 64),
                name: sanitizeHomeName(h.name),
                ownerUid: h.ownerUid.slice(0, 128),
                ownerName: sanitizeName(h.ownerName),
                ownerInstagram: sanitizeInstagram(h.ownerInstagram),
                createdByAdmin: Boolean(h.createdByAdmin),
                style,
                wallColor:
                  typeof h.wallColor === 'string' && HEX_RE.test(h.wallColor)
                    ? h.wallColor
                    : '#ece6da',
                roofColor:
                  typeof h.roofColor === 'string' && HEX_RE.test(h.roofColor)
                    ? h.roofColor
                    : '#2c3e50',
                hasPool: Boolean(h.hasPool),
                interiorTheme: (VALID_INTERIORS.has(String(h.interiorTheme) as InteriorTheme)
                  ? h.interiorTheme
                  : 'modern') as InteriorTheme,
                gardenStyle: (VALID_GARDENS.has(String(h.gardenStyle) as GardenStyle)
                  ? h.gardenStyle
                  : 'flowers') as GardenStyle,
                x: clamp(Number(h.x) || 0, -WORLD_HALF_SIZE, WORLD_HALF_SIZE),
                y: clamp(Number(h.y) || 0, -10, 60),
                z: clamp(Number(h.z) || 0, -WORLD_HALF_SIZE, WORLD_HALF_SIZE),
              });
            }
          }
        }
      }

      // Seed server custom shops from known Firestore customShops
      if (Array.isArray(payload?.knownCustomShops)) {
        for (const item of payload.knownCustomShops) {
          if (item && typeof item === 'object') {
            const sh = item as Record<string, unknown>;
            if (
              typeof sh.shopId === 'string' &&
              typeof sh.ownerUid === 'string' &&
              !customShopsById.has(sh.shopId)
            ) {
              const shopType = VALID_SHOP_TYPES.has(String(sh.shopType) as CustomShopType)
                ? (sh.shopType as CustomShopType)
                : 'tea_stall';
              customShopsById.set(sh.shopId, {
                shopId: sh.shopId.slice(0, 64),
                name: sanitizeHomeName(sh.name || 'Valley Chaya Kada'),
                shopType,
                ownerUid: sh.ownerUid.slice(0, 128),
                ownerName: sanitizeName(sh.ownerName),
                ownerInstagram: sanitizeInstagram(sh.ownerInstagram),
                awningColor:
                  typeof sh.awningColor === 'string' && HEX_RE.test(sh.awningColor)
                    ? sh.awningColor
                    : '#e11d48',
                x: clamp(Number(sh.x) || 0, -WORLD_HALF_SIZE, WORLD_HALF_SIZE),
                y: clamp(Number(sh.y) || 0, -10, 60),
                z: clamp(Number(sh.z) || 0, -WORLD_HALF_SIZE, WORLD_HALF_SIZE),
                totalSales: Math.max(0, Math.round(Number(sh.totalSales) || 0)),
              });
            }
          }
        }
      }

      if (Array.isArray(payload?.knownPublicAds)) {
        for (const rawAd of payload.knownPublicAds.slice(0, 40)) {
          if (rawAd && typeof rawAd === 'object') {
            const a = rawAd as Partial<PublicAdDef>;
            const adId = typeof a.adId === 'string' ? a.adId.slice(0, 64) : '';
            if (adId && !publicAdsById.has(adId) && typeof a.title === 'string') {
              publicAdsById.set(adId, {
                adId,
                title: sanitizeText(a.title, 42) || 'Green Valley Ad',
                subtitle: sanitizeText(a.subtitle, 96) || 'Visit us in Green Valley!',
                instagramHandle: sanitizeInstagram(a.instagramHandle),
                accentColor: typeof a.accentColor === 'string' && HEX_RE.test(a.accentColor) ? a.accentColor : '#f59e0b',
                ownerUid: typeof a.ownerUid === 'string' ? a.ownerUid.slice(0, 128) : uid,
                ownerName: sanitizeName(a.ownerName),
                createdAtMs: typeof a.createdAtMs === 'number' ? a.createdAtMs : Date.now(),
              });
            }
          }
        }
      }

      const age =
        typeof payload?.age === 'number' && Number.isFinite(payload.age)
          ? clamp(Math.round(payload.age), 18, 90)
          : 22;
      const relationshipStatus: RelationshipStatus =
        payload?.relationshipStatus === 'mingle' || payload?.relationshipStatus === 'married'
          ? payload.relationshipStatus
          : 'single';
      const partnerName = sanitizeText(payload?.partnerName, 32);
      const lastDailyLoginDate =
        typeof payload?.lastDailyLoginDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.lastDailyLoginDate)
          ? payload.lastDailyLoginDate
          : '';
      const dailyLoginStreak =
        typeof payload?.dailyLoginStreak === 'number' && Number.isFinite(payload.dailyLoginStreak)
          ? clamp(Math.round(payload.dailyLoginStreak), 0, 365)
          : 0;
      const totalDailyLogins =
        typeof payload?.totalDailyLogins === 'number' && Number.isFinite(payload.totalDailyLogins)
          ? clamp(Math.round(payload.totalDailyLogins), 0, 10000)
          : 0;
      const muscleLevel =
        typeof payload?.muscleLevel === 'number' && Number.isFinite(payload.muscleLevel)
          ? clamp(Math.round(payload.muscleLevel), 0, 10)
          : 0;
      const hasGameCenterCard = Boolean(payload?.hasGameCenterCard);

      const isAdmin = Boolean(socket.data.isAdmin);
      const netState: NetworkPlayer = {
        uid,
        displayName,
        instagramId,
        photoURL: verifiedPhoto,
        age,
        relationshipStatus,
        partnerName: partnerName || undefined,
        muscleLevel,
        heldItem: 'none',
        appearance,
        x: spawnX,
        y: spawnY,
        z: spawnZ,
        rotY: 0,
        anim: 'idle',
        speed: 0,
        vehicleId: null,
        level: levelFromXp(initXp),
        isAdmin,
        voiceActive: false,
        voiceMuted: false,
      };

      const record: ServerPlayerRecord = {
        socketId: socket.id,
        state: netState,
        isAdmin,
        lastMoveAt: Date.now(),
        lastChatAt: 0,
        lastActionAt: 0,
        lastSignalAt: 0,
        voiceActive: false,
        voiceMuted: false,
        greenCoins: initCoins,
        xp: initXp,
        level: levelFromXp(initXp),
        age,
        relationshipStatus,
        partnerName,
        lastDailyLoginDate,
        dailyLoginStreak,
        totalDailyLogins,
        muscleLevel,
        hasGameCenterCard,
        activeMingleMatch: null,
        ownedProperties: new Set(initProps),
        ownedBusinesses: new Set(initBiz),
        ownedVehicles: new Set(initVehicles),
        completedMissions: new Set(initMissions),
        claimedRewards: new Set(initRewards),
        inventory: initInventory,
        friends: new Set(initFriends),
        businessCooldowns: new Map(),
        workCooldowns: new Map(),
        buildingCooldowns: new Map(),
        dailyRewardReadyAt:
          lastDailyLoginDate && daysSinceDateKey(lastDailyLoginDate) < 7
            ? Date.now() + (7 - daysSinceDateKey(lastDailyLoginDate)) * 86400000
            : 0,
        unlockedShopIds: new Set(),
        visitedVillaIds: new Set(),
        unlockedVillaIds: new Set(),
      };
      playersByUid.set(uid, record);
      if (!mingleJoinedAt.has(uid)) {
        mingleJoinedAt.set(uid, Date.now());
      }

      const allPlayers: NetworkPlayer[] = [];
      const activeVoicePeers: { uid: string; muted: boolean }[] = [];
      for (const rec of playersByUid.values()) {
        allPlayers.push(rec.state);
        if (rec.voiceActive && rec.state.uid !== uid) {
          activeVoicePeers.push({ uid: rec.state.uid, muted: rec.voiceMuted });
        }
      }

      socket.emit('world:init', {
        selfUid: uid,
        room: WORLD_ROOM,
        isAdmin,
        villageHalfSize,
        players: allPlayers,
        vehicles: Array.from(vehiclesById.values()),
        publicBus,
        sportsBalls: Object.values(sportsBalls),
        palaceVillas: Array.from(palaceVillasById.values()).map(toPublicVilla),
        typixelUpdates: typixelUpdates.slice(0, 20),
        properties: Array.from(worldProperties.values()),
        customHomes: Array.from(customHomesById.values()),
        customShops: Array.from(customShopsById.values()),
        publicAds: Array.from(publicAdsById.values()).sort((a, b) => b.createdAtMs - a.createdAtMs),
        mingleEvent: buildMingleStateForPlayer(record),
        voicePeers: activeVoicePeers,
      });

      socket.to(WORLD_ROOM).emit('player:joined', netState);
      // Broadcast updated Single-to-Mingle joined accounts list to all online screens
      for (const rec of playersByUid.values()) {
        if (rec.state.uid !== uid) {
          io.to(rec.socketId).emit('mingle:update', buildMingleStateForPlayer(rec));
        }
      }
    });

    // Server-authoritative player movement & vehicle driving sync
    socket.on('player:move', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;

      const now = Date.now();
      const dtSec = Math.max(0.016, Math.min(0.6, (now - rec.lastMoveAt) / 1000));
      rec.lastMoveAt = now;

      const targetX =
        typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : rec.state.x;
      const targetY =
        typeof payload?.y === 'number' && Number.isFinite(payload.y) ? payload.y : rec.state.y;
      const targetZ =
        typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : rec.state.z;
      const rotY =
        typeof payload?.rotY === 'number' && Number.isFinite(payload.rotY)
          ? payload.rotY
          : rec.state.rotY;
      const animRaw = String(payload?.anim || 'idle') as AnimationState;
      const anim: AnimationState = VALID_ANIMS.has(animRaw) ? animRaw : 'idle';
      const speed =
        typeof payload?.speed === 'number' && Number.isFinite(payload.speed)
          ? clamp(payload.speed, -25, 55)
          : 0;

      const drivingVehicle = rec.state.vehicleId ? vehiclesById.get(rec.state.vehicleId) : null;
      const isTeleport = payload?.teleport === true;
      const maxRate = drivingVehicle ? drivingVehicle.maxSpeed * 1.45 : 18;
      const maxDist = isTeleport ? 900 : maxRate * dtSec + 4.5;

      const dx = targetX - rec.state.x;
      const dz = targetZ - rec.state.z;
      const dist = Math.hypot(dx, dz);

      let nextX = targetX;
      let nextZ = targetZ;
      if (dist > maxDist && dist > 0.001) {
        const scale = maxDist / dist;
        nextX = rec.state.x + dx * scale;
        nextZ = rec.state.z + dz * scale;
      }

      nextX = clamp(nextX, -villageHalfSize, villageHalfSize);
      nextZ = clamp(nextZ, -villageHalfSize, villageHalfSize);
      const minY = groundHeightAt(nextX, nextZ) - 0.5;
      const maxY = drivingVehicle?.canFly ? 76 : 30;
      const nextY = clamp(targetY, minY, maxY);

      rec.state.x = nextX;
      rec.state.y = nextY;
      rec.state.z = nextZ;
      rec.state.rotY = rotY;
      rec.state.anim = anim;
      rec.state.speed = speed;

      if (drivingVehicle && drivingVehicle.driverUid === uid) {
        drivingVehicle.x = nextX;
        drivingVehicle.y = nextY;
        drivingVehicle.z = nextZ;
        drivingVehicle.rotY = rotY;
        drivingVehicle.speed = speed;
      }
    });

    // Appearance, Age, Relationship & Instagram ID broadcast
    socket.on('player:appearance', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      rec.state.displayName = sanitizeName(payload?.displayName || rec.state.displayName);
      if (typeof payload?.instagramId === 'string') {
        rec.state.instagramId = sanitizeInstagram(payload.instagramId);
      }
      if (typeof payload?.age === 'number' && Number.isFinite(payload.age)) {
        rec.age = clamp(Math.round(payload.age), 18, 90);
        rec.state.age = rec.age;
      }
      if (
        payload?.relationshipStatus === 'single' ||
        payload?.relationshipStatus === 'mingle' ||
        payload?.relationshipStatus === 'married'
      ) {
        rec.relationshipStatus = payload.relationshipStatus;
        rec.state.relationshipStatus = rec.relationshipStatus;
      }
      rec.state.appearance = sanitizeAppearance(payload?.appearance);
      io.to(WORLD_ROOM).emit('player:appearance', {
        uid,
        displayName: rec.state.displayName,
        instagramId: rec.state.instagramId,
        age: rec.age,
        relationshipStatus: rec.relationshipStatus,
        appearance: rec.state.appearance,
        isAdmin: rec.isAdmin,
      });
      for (const p of playersByUid.values()) {
        io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
      }
    });

    // Emotes
    socket.on('player:emote', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const emote = String(payload?.emote || '') as EmoteType;
      if (!VALID_EMOTES.has(emote)) return;
      rec.state.anim = emote;
      rec.state.emoteUntil = Date.now() + 3400;
      io.to(WORLD_ROOM).emit('player:emote', { uid, emote });
    });

    // Global, Proximity & Direct Online Chat (rate limited)
    socket.on('chat:send', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const now = Date.now();
      if (now - rec.lastChatAt < 450) return;
      rec.lastChatAt = now;

      const text = sanitizeText(payload?.text, 180);
      if (!text) return;
      const rawCh = payload?.channel;
      const channel: 'global' | 'proximity' | 'direct' =
        rawCh === 'proximity' ? 'proximity' : rawCh === 'direct' ? 'direct' : 'global';

      if (channel === 'direct') {
        const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
        const target = targetUid ? playersByUid.get(targetUid) : null;
        if (!target || targetUid === uid) {
          socket.emit('action:error', { message: 'That player is no longer online.' });
          return;
        }
        const msg: ChatMessage = {
          id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
          uid,
          displayName: rec.state.displayName,
          instagramId: rec.state.instagramId || undefined,
          isAdmin: rec.isAdmin,
          photoURL: rec.state.photoURL,
          channel: 'direct',
          targetUid: target.state.uid,
          targetName: target.state.displayName,
          text,
          timestamp: now,
        };
        socket.emit('chat:message', msg);
        io.to(target.socketId).emit('chat:message', msg);
        return;
      }

      const msg: ChatMessage = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
        uid,
        displayName: rec.state.displayName,
        instagramId: rec.state.instagramId || undefined,
        isAdmin: rec.isAdmin,
        photoURL: rec.state.photoURL,
        channel,
        text,
        timestamp: now,
      };

      rec.state.chatBubble = text.slice(0, 64);
      rec.state.chatBubbleUntil = now + 5000;

      if (channel === 'global') {
        io.to(WORLD_ROOM).emit('chat:message', msg);
      } else {
        for (const other of playersByUid.values()) {
          const dist = Math.hypot(other.state.x - rec.state.x, other.state.z - rec.state.z);
          if (dist <= 40) {
            io.to(other.socketId).emit('chat:message', msg);
          }
        }
      }
    });

    // =========================================================================
    // LIVE MULTIPLAYER VOICE TALK (WebRTC Signaling via Socket.IO)
    // =========================================================================
    socket.on('voice:join', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      rec.voiceActive = true;
      rec.voiceMuted = payload?.muted === true;
      rec.state.voiceActive = true;
      rec.state.voiceMuted = rec.voiceMuted;

      const peers: { uid: string; muted: boolean }[] = [];
      for (const other of playersByUid.values()) {
        if (other.state.uid !== uid && other.voiceActive) {
          peers.push({ uid: other.state.uid, muted: other.voiceMuted });
        }
      }
      socket.emit('voice:peers', { peers });
      socket.to(WORLD_ROOM).emit('voice:user-joined', { uid, muted: rec.voiceMuted });
    });

    socket.on('voice:leave', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (!rec.voiceActive) return;
      rec.voiceActive = false;
      rec.voiceMuted = false;
      rec.state.voiceActive = false;
      rec.state.voiceMuted = false;
      socket.to(WORLD_ROOM).emit('voice:user-left', { uid });
    });

    socket.on('voice:state', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.voiceActive) return;
      rec.voiceMuted = payload?.muted === true;
      rec.state.voiceMuted = rec.voiceMuted;
      socket.to(WORLD_ROOM).emit('voice:state', { uid, muted: rec.voiceMuted });
    });

    socket.on('voice:offer', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.voiceActive) return;
      const now = Date.now();
      if (now - rec.lastSignalAt < 25) return;
      rec.lastSignalAt = now;

      const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
      const target = targetUid && targetUid !== uid ? playersByUid.get(targetUid) : null;
      if (!target || !target.voiceActive) return;
      const sdp = payload?.sdp as { type?: unknown; sdp?: unknown } | undefined;
      if (
        !sdp ||
        typeof sdp !== 'object' ||
        sdp.type !== 'offer' ||
        typeof sdp.sdp !== 'string' ||
        sdp.sdp.length > 16384
      ) {
        return;
      }
      io.to(target.socketId).emit('voice:offer', {
        fromUid: uid,
        sdp: { type: 'offer', sdp: sdp.sdp },
      });
    });

    socket.on('voice:answer', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.voiceActive) return;
      const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
      const target = targetUid && targetUid !== uid ? playersByUid.get(targetUid) : null;
      if (!target || !target.voiceActive) return;
      const sdp = payload?.sdp as { type?: unknown; sdp?: unknown } | undefined;
      if (
        !sdp ||
        typeof sdp !== 'object' ||
        sdp.type !== 'answer' ||
        typeof sdp.sdp !== 'string' ||
        sdp.sdp.length > 16384
      ) {
        return;
      }
      io.to(target.socketId).emit('voice:answer', {
        fromUid: uid,
        sdp: { type: 'answer', sdp: sdp.sdp },
      });
    });

    socket.on('voice:ice', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.voiceActive) return;
      const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
      const target = targetUid && targetUid !== uid ? playersByUid.get(targetUid) : null;
      if (!target || !target.voiceActive) return;
      const cand = payload?.candidate as { candidate?: unknown; sdpMid?: unknown; sdpMLineIndex?: unknown } | undefined;
      if (
        !cand ||
        typeof cand !== 'object' ||
        typeof cand.candidate !== 'string' ||
        cand.candidate.length > 2048
      ) {
        return;
      }
      io.to(target.socketId).emit('voice:ice', {
        fromUid: uid,
        candidate: {
          candidate: cand.candidate,
          sdpMid: typeof cand.sdpMid === 'string' ? cand.sdpMid.slice(0, 64) : null,
          sdpMLineIndex: typeof cand.sdpMLineIndex === 'number' ? cand.sdpMLineIndex : null,
        },
      });
    });

    // =========================================================================
    // VEHICLES: Admin accesses ALL freely; normal players walk up & pay coins
    // =========================================================================
    socket.on('vehicle:enter', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || rec.state.vehicleId) return;
      const vehicleId = typeof payload?.vehicleId === 'string' ? payload.vehicleId : '';
      const mode =
        payload?.mode === 'rent' || payload?.mode === 'buy' || payload?.mode === 'free'
          ? payload.mode
          : 'free';

      const veh = vehiclesById.get(vehicleId);
      if (!veh || veh.driverUid !== null) {
        socket.emit('action:error', { message: 'Vehicle is currently occupied.' });
        return;
      }

      // Normal players MUST walk physically up to the vehicle; Admins access freely
      const dist = Math.hypot(rec.state.x - veh.x, rec.state.z - veh.z);
      if (!rec.isAdmin && dist > 14) {
        socket.emit('action:error', {
          message: 'Walk physically up to this vehicle first to take or rent it.',
        });
        return;
      }

      const isAlreadyOwned = rec.ownedVehicles.has(veh.id);
      const isFreeVehicle = veh.rentPrice <= 0 && veh.buyPrice <= 0;

      if (!rec.isAdmin && !isFreeVehicle && !isAlreadyOwned) {
        if (mode === 'rent') {
          if (rec.greenCoins < veh.rentPrice) {
            socket.emit('action:error', {
              message: `Need ${veh.rentPrice} GC to rent ${veh.name} (you have ${rec.greenCoins} GC).`,
            });
            return;
          }
          rec.greenCoins -= veh.rentPrice;
          socket.emit('economy:update', {
            greenCoins: rec.greenCoins,
            xp: rec.xp,
            level: rec.level,
            tx: {
              type: 'spend',
              amount: veh.rentPrice,
              reason: `Rented ${veh.name}`,
              balanceAfter: rec.greenCoins,
            },
            toast: {
              title: `Rented ${veh.name}`,
              detail: `-${veh.rentPrice} Green Coins · Enjoy the drive!`,
              tone: 'amber',
            },
          });
        } else if (mode === 'buy') {
          if (rec.greenCoins < veh.buyPrice) {
            socket.emit('action:error', {
              message: `Need ${veh.buyPrice} GC to buy ${veh.name} permanently.`,
            });
            return;
          }
          rec.greenCoins -= veh.buyPrice;
          rec.ownedVehicles.add(veh.id);
          socket.emit('economy:update', {
            greenCoins: rec.greenCoins,
            xp: rec.xp,
            level: rec.level,
            ownedVehicles: Array.from(rec.ownedVehicles),
            tx: {
              type: 'spend',
              amount: veh.buyPrice,
              reason: `Bought ${veh.name}`,
              balanceAfter: rec.greenCoins,
            },
            toast: {
              title: `Unlocked ${veh.name}`,
              detail: 'Walk up anytime to drive for free!',
              tone: 'emerald',
            },
          });
        } else {
          socket.emit('action:error', {
            message: `${veh.name} requires ${veh.rentPrice} GC to rent or ${veh.buyPrice} GC to buy.`,
          });
          return;
        }
      }

      veh.driverUid = uid;
      rec.state.vehicleId = veh.id;
      rec.state.x = veh.x;
      rec.state.y = veh.y;
      rec.state.z = veh.z;
      rec.state.rotY = veh.rotY;
      rec.state.anim = 'drive';
      io.to(WORLD_ROOM).emit('vehicle:updated', veh);
      socket.emit('vehicle:entered', { vehicleId: veh.id });
    });

    // Exit Vehicle
    socket.on('vehicle:exit', () => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.state.vehicleId) return;
      const veh = vehiclesById.get(rec.state.vehicleId);
      if (veh && veh.driverUid === uid) {
        veh.driverUid = null;
        veh.speed = 0;
        const groundY = Math.max(0, groundHeightAt(veh.x, veh.z));
        if (veh.y < groundY + 1.5) veh.y = groundY;
        io.to(WORLD_ROOM).emit('vehicle:updated', veh);
      }
      rec.state.vehicleId = null;
      rec.state.anim = 'idle';
      socket.emit('vehicle:exited', {});
    });

    // =========================================================================
    // REPEATABLE WORKS / JOBS & REWARDS (Earn Green Coins!)
    // =========================================================================
    socket.on('work:complete', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const jobId = typeof payload?.jobId === 'string' ? payload.jobId : '';
      const job = WORK_JOBS.find((j) => j.id === jobId);
      if (!job) return;

      const now = Date.now();
      const readyAt = rec.workCooldowns.get(job.id) || 0;
      if (now < readyAt) {
        const secs = Math.ceil((readyAt - now) / 1000);
        socket.emit('action:error', { message: `Work shift available again in ${secs}s.` });
        return;
      }

      const dist = Math.hypot(rec.state.x - job.target.x, rec.state.z - job.target.z);
      if (dist > 26) {
        socket.emit('action:error', {
          message: `Travel to ${job.targetName} to finish this work shift.`,
        });
        return;
      }

      const nextReady = now + job.cooldownSec * 1000;
      rec.workCooldowns.set(job.id, nextReady);
      rec.greenCoins = clamp(rec.greenCoins + job.payout, 0, 10000000);
      rec.xp = clamp(rec.xp + job.xp, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        workCooldown: { jobId: job.id, readyAt: nextReady },
        completedWorkId: job.id,
        tx: {
          type: 'earn',
          amount: job.payout,
          reason: `Work: ${job.title}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Work Shift Paid: +${job.payout} GC`,
          detail: `${job.title} · +${job.xp} XP`,
          tone: 'emerald',
        },
      });
    });

    socket.on('reward:claim', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const rewardId = typeof payload?.rewardId === 'string' ? payload.rewardId : '';
      const reward = REWARDS.find((r) => r.id === rewardId);
      if (!reward) return;

      const now = Date.now();
      if (reward.repeatableSec) {
        if (now < rec.dailyRewardReadyAt) {
          const daysLeft = Math.max(1, Math.ceil((rec.dailyRewardReadyAt - now) / 86400000));
          socket.emit('action:error', {
            message: `Weekly reward can only be claimed once per week! Ready again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          });
          return;
        }
        rec.dailyRewardReadyAt = now + WEEKLY_REWARD_COOLDOWN_SEC * 1000;
        rec.lastDailyLoginDate = getTodayDateKey();
      } else {
        if (rec.claimedRewards.has(reward.id)) {
          socket.emit('action:error', { message: 'Reward already claimed.' });
          return;
        }
        // Validate eligibility server-side
        if (reward.id === 'rew-insta-profile' && rec.state.instagramId.length < 2) {
          socket.emit('action:error', {
            message: 'Add your Instagram ID in Character Customization first.',
          });
          return;
        }
        if (reward.id === 'rew-first-home') {
          let ownsCustom = false;
          for (const h of customHomesById.values()) {
            if (h.ownerUid === uid) {
              ownsCustom = true;
              break;
            }
          }
          if (rec.ownedProperties.size === 0 && !ownsCustom) {
            socket.emit('action:error', {
              message: 'Buy or build your first home in Green Valley to claim this reward.',
            });
            return;
          }
        }
        if (reward.id === 'rew-vehicle-owner' && rec.ownedVehicles.size === 0) {
          socket.emit('action:error', {
            message: 'Walk up to any paid vehicle and unlock it permanently first.',
          });
          return;
        }
        if (reward.id === 'rew-mission-ace' && rec.completedMissions.size < 2) {
          socket.emit('action:error', {
            message: 'Complete at least 2 Green Valley missions first.',
          });
          return;
        }
        rec.claimedRewards.add(reward.id);
      }

      rec.greenCoins = clamp(rec.greenCoins + reward.coins, 0, 10000000);
      rec.xp = clamp(rec.xp + reward.xp, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        claimedRewards: Array.from(rec.claimedRewards),
        dailyRewardReadyAt: rec.dailyRewardReadyAt,
        tx: {
          type: 'earn',
          amount: reward.coins,
          reason: `Reward: ${reward.title}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Reward Claimed: +${reward.coins} GC`,
          detail: `${reward.title} · +${reward.xp} XP`,
          tone: 'amber',
        },
      });
    });

    // =========================================================================
    // CUSTOM 3D HOME BUILDER (Road-Clearance Enforced + Tiered Facility Pricing!)
    // =========================================================================
    socket.on('home:build', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const style = String(payload?.style || 'cabin') as CustomHomeStyle;
      const plan = CUSTOM_HOME_PLANS.find((p) => p.style === style);
      if (!plan) return;

      const requestedX =
        typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : rec.state.x + 14;
      const requestedZ =
        typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : rec.state.z;
      const hx = clamp(requestedX, -villageHalfSize + 24, villageHalfSize - 24);
      const hz = clamp(requestedZ, -villageHalfSize + 24, villageHalfSize - 24);

      const roadCheck = isPositionOnRoad(hx, hz, Math.max(14, plan.size.x * 0.75));
      if (roadCheck.onRoad) {
        socket.emit('action:error', {
          message: `${roadCheck.reason || 'Cannot build on roads!'} Use the Position Selector to pick an open plot.`,
        });
        return;
      }

      const hasPool = plan.defaultPool || payload?.hasPool === true;
      const hasGarden = payload?.hasGarden === true;
      const hasAc = payload?.hasAc === true;
      const totalPrice = computeHouseTotalPrice(plan.style, { hasPool, hasGarden, hasAc });
      const cost = rec.isAdmin ? 0 : totalPrice;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${totalPrice} GC to build ${plan.label} with selected facilities (you have ${rec.greenCoins} GC).`,
        });
        return;
      }

      const hy = Math.max(0, groundHeightAt(hx, hz));
      const homeName = sanitizeHomeName(payload?.name || `${rec.state.displayName}'s ${plan.label}`);
      const wallColor =
        typeof payload?.wallColor === 'string' && HEX_RE.test(payload.wallColor)
          ? payload.wallColor
          : '#ece6da';
      const roofColor =
        typeof payload?.roofColor === 'string' && HEX_RE.test(payload.roofColor)
          ? payload.roofColor
          : '#2c3e50';
      const interiorTheme = VALID_INTERIORS.has(String(payload?.interiorTheme) as InteriorTheme)
        ? (payload.interiorTheme as InteriorTheme)
        : 'modern';
      const gardenStyle = VALID_GARDENS.has(String(payload?.gardenStyle) as GardenStyle)
        ? (payload.gardenStyle as GardenStyle)
        : 'flowers';

      const homeId = `home_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const customHome: CustomHomeDef = {
        homeId,
        name: homeName,
        ownerUid: uid,
        ownerName: rec.state.displayName,
        ownerInstagram: rec.state.instagramId,
        createdByAdmin: rec.isAdmin,
        style: plan.style,
        wallColor,
        roofColor,
        hasPool,
        hasGarden,
        hasAc,
        interiorTheme,
        gardenStyle,
        x: Number(hx.toFixed(1)),
        y: Number(hy.toFixed(2)),
        z: Number(hz.toFixed(1)),
      };

      if (cost > 0) {
        rec.greenCoins -= cost;
      }
      rec.ownedProperties.add(homeId);
      customHomesById.set(homeId, customHome);

      io.to(WORLD_ROOM).emit('customHome:created', customHome);
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ownedProperties: Array.from(rec.ownedProperties),
        createdHome: customHome,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `Built ${homeName} (${plan.tierLabel})`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: `Home Built: ${homeName}`,
          detail: rec.isAdmin
            ? `Admin Free Build at (${Math.round(hx)}, ${Math.round(hz)})!`
            : `Placed off-road at (${Math.round(hx)}, ${Math.round(hz)})!`,
          tone: 'emerald',
        },
      });
    });

    // =========================================================================
    // ADMIN STUDIO: Build Homes for ANY Player, Manage Homes, Grant Coins
    // =========================================================================
    socket.on('admin:buildHome', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Admin privileges required.' });
        return;
      }

      const style = String(payload?.style || 'villa') as CustomHomeStyle;
      const plan = CUSTOM_HOME_PLANS.find((p) => p.style === style) || CUSTOM_HOME_PLANS[2];

      // Target can be an online player UID OR any custom resident name/Instagram ID
      const targetUidInput = typeof payload?.targetUid === 'string' ? payload.targetUid.trim() : '';
      const onlineTarget = targetUidInput ? playersByUid.get(targetUidInput) : null;

      const ownerUid = onlineTarget
        ? onlineTarget.state.uid
        : targetUidInput.length >= 3
          ? targetUidInput.slice(0, 128)
          : `resident_${crypto.randomBytes(4).toString('hex')}`;
      const ownerName = onlineTarget
        ? onlineTarget.state.displayName
        : sanitizeName(payload?.ownerName || 'Valley Resident');
      const ownerInstagram = onlineTarget
        ? onlineTarget.state.instagramId || sanitizeInstagram(payload?.ownerInstagram)
        : sanitizeInstagram(payload?.ownerInstagram);

      const requestedX =
        typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : rec.state.x + 15;
      const requestedZ =
        typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : rec.state.z;
      const hx = clamp(requestedX, -villageHalfSize + 24, villageHalfSize - 24);
      const hz = clamp(requestedZ, -villageHalfSize + 24, villageHalfSize - 24);
      const roadCheck = isPositionOnRoad(hx, hz, Math.max(14, plan.size.x * 0.75));
      if (roadCheck.onRoad) {
        socket.emit('action:error', {
          message: `${roadCheck.reason || 'Cannot place homes on roads!'} Use the Position Selector to pick an off-road plot.`,
        });
        return;
      }
      const coords = {
        x: Number(hx.toFixed(1)),
        y: Number(Math.max(0, groundHeightAt(hx, hz)).toFixed(2)),
        z: Number(hz.toFixed(1)),
      };

      const homeName = sanitizeHomeName(payload?.name || `${ownerName}'s Residence`);
      const wallColor =
        typeof payload?.wallColor === 'string' && HEX_RE.test(payload.wallColor)
          ? payload.wallColor
          : '#f4efe6';
      const roofColor =
        typeof payload?.roofColor === 'string' && HEX_RE.test(payload.roofColor)
          ? payload.roofColor
          : '#1e3a5f';
      const interiorTheme = VALID_INTERIORS.has(String(payload?.interiorTheme) as InteriorTheme)
        ? (payload.interiorTheme as InteriorTheme)
        : 'luxury';
      const gardenStyle = VALID_GARDENS.has(String(payload?.gardenStyle) as GardenStyle)
        ? (payload.gardenStyle as GardenStyle)
        : 'poolside';
      const hasPool = payload?.hasPool === true;

      const homeId = `home_adm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const customHome: CustomHomeDef = {
        homeId,
        name: homeName,
        ownerUid,
        ownerName,
        ownerInstagram,
        createdByAdmin: true,
        style: plan.style,
        wallColor,
        roofColor,
        hasPool,
        interiorTheme,
        gardenStyle,
        x: coords.x,
        y: coords.y,
        z: coords.z,
      };

      customHomesById.set(homeId, customHome);
      io.to(WORLD_ROOM).emit('customHome:created', customHome);

      // Persist callback to admin client (if Firebase admin email) and notify recipient if online
      socket.emit('admin:homeCreated', { home: customHome });
      socket.emit('toast:info', {
        title: `Built Home for ${ownerName}`,
        detail: `${homeName} placed at (${Math.round(coords.x)}, ${Math.round(coords.z)})`,
      });

      if (onlineTarget && onlineTarget.state.uid !== uid) {
        onlineTarget.ownedProperties.add(homeId);
        io.to(onlineTarget.socketId).emit('economy:update', {
          greenCoins: onlineTarget.greenCoins,
          xp: onlineTarget.xp,
          level: onlineTarget.level,
          ownedProperties: Array.from(onlineTarget.ownedProperties),
          createdHome: customHome,
          toast: {
            title: `Admin Built You a Home!`,
            detail: `${homeName} is ready at (${Math.round(coords.x)}, ${Math.round(coords.z)})`,
            tone: 'emerald',
          },
        });
      }
    });

    socket.on('admin:deleteHome', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Admin privileges required.' });
        return;
      }
      const homeId = typeof payload?.homeId === 'string' ? payload.homeId : '';
      if (!homeId || !customHomesById.has(homeId)) return;
      customHomesById.delete(homeId);
      io.to(WORLD_ROOM).emit('customHome:deleted', { homeId });
      socket.emit('toast:info', {
        title: 'Custom Home Removed',
        detail: 'Removed from Green Valley for all players.',
      });
    });

    socket.on('admin:grantCoins', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Admin privileges required.' });
        return;
      }
      const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
      const amount = clamp(Math.round(Number(payload?.amount) || 0), 1, 5000);
      const target = playersByUid.get(targetUid);
      if (!target) {
        socket.emit('action:error', { message: 'Target player is not online.' });
        return;
      }
      target.greenCoins = clamp(target.greenCoins + amount, 0, 10000000);
      io.to(target.socketId).emit('economy:update', {
        greenCoins: target.greenCoins,
        xp: target.xp,
        level: target.level,
        tx: {
          type: 'earn',
          amount,
          reason: `Admin Gift from ${rec.state.displayName}`,
          balanceAfter: target.greenCoins,
        },
        toast: {
          title: `Received +${amount} GC`,
          detail: `Admin grant from ${rec.state.displayName}`,
          tone: 'amber',
        },
      });
      if (target.state.uid !== uid) {
        socket.emit('toast:info', {
          title: `Granted +${amount} GC`,
          detail: `Sent to ${target.state.displayName}`,
        });
      }
    });

    // Server-validated Mission Completion
    socket.on('mission:complete', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const missionId = typeof payload?.missionId === 'string' ? payload.missionId : '';
      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) return;
      if (rec.completedMissions.has(mission.id)) {
        socket.emit('action:error', { message: 'Mission already completed.' });
        return;
      }

      const dist = Math.hypot(rec.state.x - mission.target.x, rec.state.z - mission.target.z);
      if (dist > 26) {
        socket.emit('action:error', { message: 'Travel to the mission objective first.' });
        return;
      }

      rec.completedMissions.add(mission.id);
      rec.greenCoins = clamp(rec.greenCoins + mission.rewardCoins, 0, 10000000);
      rec.xp = clamp(rec.xp + mission.rewardXp, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        completedMissions: Array.from(rec.completedMissions),
        tx: {
          type: 'earn',
          amount: mission.rewardCoins,
          reason: `Mission: ${mission.title}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Mission Complete: ${mission.title}`,
          detail: `+${mission.rewardCoins} Green Coins · +${mission.rewardXp} XP`,
          tone: 'emerald',
        },
      });
    });

    // Server-validated Property Purchase (Admin free; normal players spend coins)
    socket.on('property:buy', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const propertyId = typeof payload?.propertyId === 'string' ? payload.propertyId : '';
      const propDef = PROPERTIES.find((p) => p.id === propertyId);
      if (!propDef) return;

      const currentOwner = worldProperties.get(propertyId);
      if (currentOwner && currentOwner.ownerUid !== uid) {
        socket.emit('action:error', {
          message: `Already owned by ${currentOwner.ownerName}.`,
        });
        return;
      }
      if (rec.ownedProperties.has(propertyId)) {
        socket.emit('action:error', { message: 'You already own this property.' });
        return;
      }
      const cost = rec.isAdmin ? 0 : propDef.price;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${propDef.price} Green Coins (you have ${rec.greenCoins}).`,
        });
        return;
      }

      if (cost > 0) {
        rec.greenCoins -= cost;
      }
      rec.ownedProperties.add(propertyId);
      const ownership: WorldPropertyOwnership = {
        propertyId,
        ownerUid: uid,
        ownerName: rec.state.displayName,
        interiorTheme: 'modern',
        gardenStyle: 'flowers',
      };
      worldProperties.set(propertyId, ownership);

      io.to(WORLD_ROOM).emit('property:updated', ownership);
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ownedProperties: Array.from(rec.ownedProperties),
        claimedProperty: ownership,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `Purchased ${propDef.name}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: rec.isAdmin ? `Claimed Free: ${propDef.name}` : `Property Purchased: ${propDef.name}`,
          detail: 'Welcome home! Customize interior & garden anytime.',
          tone: 'emerald',
        },
      });
    });

    // Property Customization Broadcast (Owner or Admin)
    socket.on('property:customize', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const propertyId = typeof payload?.propertyId === 'string' ? payload.propertyId : '';
      const ownership = worldProperties.get(propertyId);
      if (!ownership || (ownership.ownerUid !== uid && !rec.isAdmin)) return;

      const interiorTheme = VALID_INTERIORS.has(String(payload?.interiorTheme) as InteriorTheme)
        ? (payload.interiorTheme as InteriorTheme)
        : ownership.interiorTheme;
      const gardenStyle = VALID_GARDENS.has(String(payload?.gardenStyle) as GardenStyle)
        ? (payload.gardenStyle as GardenStyle)
        : ownership.gardenStyle;

      ownership.interiorTheme = interiorTheme;
      ownership.gardenStyle = gardenStyle;
      if (ownership.ownerUid === uid) {
        ownership.ownerName = rec.state.displayName;
      }
      io.to(WORLD_ROOM).emit('property:updated', ownership);
    });

    // Server-validated Business Purchase (Admin free; normal players spend coins)
    socket.on('business:buy', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const businessId = typeof payload?.businessId === 'string' ? payload.businessId : '';
      const biz = BUSINESSES.find((b) => b.id === businessId);
      if (!biz) return;
      if (rec.ownedBusinesses.has(businessId)) {
        socket.emit('action:error', { message: 'You already own this business.' });
        return;
      }
      const cost = rec.isAdmin ? 0 : biz.price;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${biz.price} Green Coins to acquire ${biz.name}.`,
        });
        return;
      }

      if (cost > 0) {
        rec.greenCoins -= cost;
      }
      rec.ownedBusinesses.add(businessId);
      const readyAt = Date.now() + biz.cooldownSec * 1000;
      rec.businessCooldowns.set(businessId, readyAt);

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ownedBusinesses: Array.from(rec.ownedBusinesses),
        businessCooldown: { businessId, readyAt },
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `Acquired ${biz.name}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: rec.isAdmin ? `Admin Free Access: ${biz.name}` : `Business Acquired: ${biz.name}`,
          detail: `Earns ${biz.payout} Green Coins every ${biz.cooldownSec}s.`,
          tone: 'amber',
        },
      });
    });

    // Server-validated Business Revenue Collection
    socket.on('business:collect', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const businessId = typeof payload?.businessId === 'string' ? payload.businessId : '';
      const biz = BUSINESSES.find((b) => b.id === businessId);
      if (!biz || !rec.ownedBusinesses.has(businessId)) return;

      const now = Date.now();
      const readyAt = rec.businessCooldowns.get(businessId) || 0;
      if (now < readyAt) {
        const secs = Math.ceil((readyAt - now) / 1000);
        socket.emit('action:error', { message: `Revenue ready in ${secs}s.` });
        return;
      }

      rec.greenCoins = clamp(rec.greenCoins + biz.payout, 0, 10000000);
      rec.xp = clamp(rec.xp + 35, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;
      const nextReady = now + biz.cooldownSec * 1000;
      rec.businessCooldowns.set(businessId, nextReady);

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        businessCooldown: { businessId, readyAt: nextReady },
        tx: {
          type: 'earn',
          amount: biz.payout,
          reason: `${biz.name} revenue`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Collected ${biz.payout} GC`,
          detail: biz.name,
          tone: 'emerald',
        },
      });
    });

    // Server-validated Shop Item Purchase (Admin free; normal players spend coins)
    socket.on('shop:buy', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const itemId = typeof payload?.itemId === 'string' ? payload.itemId : '';
      const item = SHOP_ITEMS.find((i) => i.id === itemId);
      if (!item) return;
      if (rec.inventory.length >= 30) {
        socket.emit('action:error', { message: 'Inventory is full (max 30 items).' });
        return;
      }
      const cost = rec.isAdmin ? 0 : item.price;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', { message: `Need ${item.price} Green Coins.` });
        return;
      }

      if (cost > 0) {
        rec.greenCoins -= cost;
      }
      rec.inventory.push(item.id);

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        inventory: [...rec.inventory],
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `Bought ${item.name}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: rec.isAdmin ? `Admin Free Item: ${item.name}` : `Purchased ${item.name}`,
          detail: 'Added to your Inventory',
          tone: 'sky',
        },
      });
    });

    // Use Consumable Item
    socket.on('inventory:use', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const itemId = typeof payload?.itemId === 'string' ? payload.itemId : '';
      const idx = rec.inventory.indexOf(itemId);
      if (idx === -1) return;
      const item = SHOP_ITEMS.find((i) => i.id === itemId);
      if (!item || !item.healthRestore) return;

      rec.inventory.splice(idx, 1);
      const heldItem: HeldItemType = item.id.includes('latte') ? 'latte' : 'snack';
      const nowHold = Date.now();
      rec.state.heldItem = heldItem;
      rec.state.heldItemUntil = nowHold + 11000;
      rec.state.anim = heldItem === 'snack' ? 'eat' : 'drink';
      rec.state.emoteUntil = nowHold + 4000;
      io.to(WORLD_ROOM).emit('player:heldItem', {
        uid,
        heldItem,
        heldItemUntil: rec.state.heldItemUntil,
        anim: rec.state.anim,
      });
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        inventory: [...rec.inventory],
        healthRestore: item.healthRestore,
        heldItem,
        toast: {
          title: `Enjoying ${item.name} in Hand!`,
          detail: `+${item.healthRestore} Health restored`,
          tone: 'emerald',
        },
      });
    });

    // Real-time Friend Requests
    socket.on('friend:request', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
      if (!targetUid || targetUid === uid) return;
      const target = playersByUid.get(targetUid);
      if (!target) {
        socket.emit('action:error', { message: 'Player is not currently online.' });
        return;
      }
      if (rec.friends.has(targetUid)) {
        socket.emit('action:error', { message: 'Already in your friends list.' });
        return;
      }
      io.to(target.socketId).emit('friend:incoming', {
        fromUid: uid,
        fromName: rec.state.displayName,
        fromPhoto: rec.state.photoURL,
        timestamp: Date.now(),
      });
      socket.emit('toast:info', {
        title: 'Friend Request Sent',
        detail: `Waiting for ${target.state.displayName} to accept`,
      });
    });

    socket.on('friend:accept', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const fromUid = typeof payload?.fromUid === 'string' ? payload.fromUid : '';
      if (!fromUid || fromUid === uid) return;

      rec.friends.add(fromUid);
      socket.emit('friends:update', { friends: Array.from(rec.friends) });

      const other = playersByUid.get(fromUid);
      if (other) {
        other.friends.add(uid);
        io.to(other.socketId).emit('friends:update', {
          friends: Array.from(other.friends),
          toast: {
            title: 'Friend Connected',
            detail: `${rec.state.displayName} accepted your friend request`,
            tone: 'emerald',
          },
        });
      }
    });

    // =========================================================================
    // WEEKLY REWARD BONUS (Strictly Once Per Week — 7-Day Cooldown Tracked in Firestore)
    // =========================================================================
    socket.on('daily:claim', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const today = getTodayDateKey();
      const daysElapsed = daysSinceDateKey(rec.lastDailyLoginDate);
      if (rec.lastDailyLoginDate && daysElapsed < 7) {
        const remainingDays = 7 - daysElapsed;
        socket.emit('action:error', {
          message: `Weekly Reward can only be claimed once per week! Next claim available in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`,
        });
        return;
      }
      const nextStreak =
        rec.lastDailyLoginDate && daysElapsed <= 14
          ? Math.min(365, rec.dailyLoginStreak + 1)
          : 1;
      const tier = DAILY_LOGIN_REWARDS[(nextStreak - 1) % DAILY_LOGIN_REWARDS.length];

      rec.lastDailyLoginDate = today;
      rec.dailyRewardReadyAt = Date.now() + WEEKLY_REWARD_COOLDOWN_SEC * 1000;
      rec.dailyLoginStreak = nextStreak;
      rec.totalDailyLogins = Math.min(10000, rec.totalDailyLogins + 1);
      rec.greenCoins = clamp(rec.greenCoins + tier.coins, 0, 10000000);
      rec.xp = clamp(rec.xp + tier.xp, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        lastDailyLoginDate: rec.lastDailyLoginDate,
        dailyLoginStreak: rec.dailyLoginStreak,
        totalDailyLogins: rec.totalDailyLogins,
        dailyRewardReadyAt: rec.dailyRewardReadyAt,
        tx: {
          type: 'earn',
          amount: tier.coins,
          reason: `Weekly Reward (Week ${nextStreak})`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Week ${nextStreak} Reward: +${tier.coins} GC!`,
          detail: `Claimed once this week · +${tier.xp} XP`,
          tone: 'amber',
        },
      });
    });

    // =========================================================================
    // PLAYER-CREATED SHOPS OFF-ROAD + TIERED FACILITIES + SECRET OWNER KEY
    // =========================================================================
    socket.on('shop:open', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const shopType = String(payload?.shopType || 'tea_stall') as CustomShopType;
      const plan = CUSTOM_SHOP_PLANS.find((p) => p.shopType === shopType);
      if (!plan) return;

      const rawKey = typeof payload?.ownerKey === 'string' ? payload.ownerKey.trim() : '';
      if (rawKey.length < 4 || rawKey.length > 24) {
        socket.emit('action:error', {
          message: 'Please set a Secret Owner Key (4–24 characters) to protect your shop interior.',
        });
        return;
      }

      const sizeTier: ShopSizeTier = VALID_SHOP_TIERS.has(String(payload?.sizeTier) as ShopSizeTier)
        ? (payload.sizeTier as ShopSizeTier)
        : 'small';
      const hasSeating = payload?.hasSeating === true;
      const hasAc = payload?.hasAc === true;

      const rawX = typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : rec.state.x + 8;
      const rawZ = typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : rec.state.z + 8;
      const sx = clamp(rawX, -villageHalfSize + 20, villageHalfSize - 20);
      const sz = clamp(rawZ, -villageHalfSize + 20, villageHalfSize - 20);

      const roadCheck = isPositionOnRoad(sx, sz, sizeTier === 'palace' ? 18 : 13);
      if (roadCheck.onRoad) {
        socket.emit('action:error', {
          message: `${roadCheck.reason || 'Shops cannot be built on roads!'} Pick a green valid spot in the Position Selector.`,
        });
        return;
      }

      const totalPrice = computeShopTotalPrice(plan.price, sizeTier, { hasSeating, hasAc });
      const cost = rec.isAdmin ? 0 : totalPrice;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${totalPrice} GC to open ${plan.label} (${sizeTier}) — you have ${rec.greenCoins} GC.`,
        });
        return;
      }

      const sy = Math.max(0, groundHeightAt(sx, sz));
      const shopName = sanitizeHomeName(payload?.name || `${rec.state.displayName}'s ${plan.label}`);
      const awningColor =
        typeof payload?.awningColor === 'string' && HEX_RE.test(payload.awningColor)
          ? payload.awningColor
          : plan.defaultAwning;

      const shopId = `shop_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const shop: CustomShopDef = {
        shopId,
        name: shopName,
        shopType: plan.shopType,
        sizeTier,
        hasSeating,
        hasAc,
        ownerUid: uid,
        ownerName: rec.state.displayName,
        ownerInstagram: rec.state.instagramId,
        awningColor,
        ownerKeyHash: hashShopSecretKey(rawKey),
        x: Number(sx.toFixed(1)),
        y: Number(sy.toFixed(2)),
        z: Number(sz.toFixed(1)),
        totalSales: 0,
      };

      if (cost > 0) rec.greenCoins -= cost;
      customShopsById.set(shopId, shop);
      io.to(WORLD_ROOM).emit('customShop:created', shop);

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        createdShop: shop,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `Opened ${shopName} (${sizeTier})`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: `Shop Opened: ${shopName}!`,
          detail: `Placed off-road (${sizeTier.toUpperCase()}) · Enter inside with your secret key!`,
          tone: 'emerald',
        },
      });
    });

    socket.on('shop:unlockInterior', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const shopId = typeof payload?.shopId === 'string' ? payload.shopId : '';
      const keyAttempt = typeof payload?.key === 'string' ? payload.key.trim() : '';
      const shop = customShopsById.get(shopId);
      if (!shop) {
        socket.emit('action:error', { message: 'Shop not found.' });
        return;
      }
      if (shop.ownerUid !== uid) {
        socket.emit('action:error', {
          message: 'Only the shop owner can enter inside this shop!',
        });
        return;
      }
      if (!shop.ownerKeyHash) {
        rec.unlockedShopIds.add(shopId);
        socket.emit('shop:interiorUnlocked', { shopId });
        return;
      }
      if (!keyAttempt || hashShopSecretKey(keyAttempt) !== shop.ownerKeyHash) {
        socket.emit('action:error', { message: 'Incorrect Shop Secret Key! Access denied.' });
        return;
      }
      rec.unlockedShopIds.add(shopId);
      socket.emit('shop:interiorUnlocked', { shopId });
      socket.emit('toast:info', {
        title: `Entered Inside ${shop.name}`,
        detail: 'Owner interior unlocked! You can change your secret key from inside.',
      });
    });

    socket.on('shop:changeKey', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const shopId = typeof payload?.shopId === 'string' ? payload.shopId : '';
      const newKey = typeof payload?.newKey === 'string' ? payload.newKey.trim() : '';
      const shop = customShopsById.get(shopId);
      if (!shop) {
        socket.emit('action:error', { message: 'Shop not found.' });
        return;
      }
      if (shop.ownerUid !== uid) {
        socket.emit('action:error', { message: 'Only the shop owner can change the secret key.' });
        return;
      }
      if (!rec.unlockedShopIds.has(shopId)) {
        socket.emit('action:error', { message: 'Unlock and enter inside your shop first to change the key.' });
        return;
      }
      if (newKey.length < 4 || newKey.length > 24) {
        socket.emit('action:error', { message: 'New secret key must be 4–24 characters.' });
        return;
      }
      shop.ownerKeyHash = hashShopSecretKey(newKey);
      io.to(WORLD_ROOM).emit('customShop:updated', shop);
      socket.emit('shop:keyChanged', { shop });
      socket.emit('toast:info', {
        title: 'Shop Secret Key Updated!',
        detail: `New owner interior key saved for ${shop.name}.`,
      });
    });

    socket.on('shop:purchaseFromPlayer', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const shopId = typeof payload?.shopId === 'string' ? payload.shopId : '';
      const menuItemId = typeof payload?.menuItemId === 'string' ? payload.menuItemId : '';
      const shop = customShopsById.get(shopId);
      if (!shop) {
        socket.emit('action:error', { message: 'This shop is no longer open.' });
        return;
      }
      const plan = CUSTOM_SHOP_PLANS.find((p) => p.shopType === shop.shopType);
      const item = plan?.menuItems.find((i) => i.id === menuItemId);
      if (!item) return;

      const cost = rec.isAdmin ? 0 : item.price;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', { message: `Need ${item.price} GC for ${item.name}.` });
        return;
      }

      if (cost > 0) rec.greenCoins -= cost;
      rec.xp = clamp(rec.xp + item.xp, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      shop.totalSales += 1;
      io.to(WORLD_ROOM).emit('customShop:updated', shop);

      // Pay the shop owner if online and not self-buying
      const ownerRec = playersByUid.get(shop.ownerUid);
      if (ownerRec && ownerRec.state.uid !== uid) {
        ownerRec.greenCoins = clamp(ownerRec.greenCoins + item.price, 0, 10000000);
        io.to(ownerRec.socketId).emit('economy:update', {
          greenCoins: ownerRec.greenCoins,
          xp: ownerRec.xp,
          level: ownerRec.level,
          tx: {
            type: 'earn',
            amount: item.price,
            reason: `Sale: ${item.name} (${shop.name})`,
            balanceAfter: ownerRec.greenCoins,
          },
          toast: {
            title: `Shop Sale: +${item.price} GC!`,
            detail: `${rec.state.displayName} bought ${item.name} at ${shop.name}`,
            tone: 'amber',
          },
        });
      }

      // Visibly equip the bought item in player's right hand & animate drinking/eating!
      const equipItem: HeldItemType = item.heldItem || 'tea';
      const nowHold = Date.now();
      rec.state.heldItem = equipItem;
      rec.state.heldItemUntil = nowHold + 12000;
      rec.state.anim = equipItem === 'snack' ? 'eat' : 'drink';
      rec.state.emoteUntil = nowHold + 4200;
      io.to(WORLD_ROOM).emit('player:heldItem', {
        uid,
        heldItem: equipItem,
        heldItemUntil: rec.state.heldItemUntil,
        anim: rec.state.anim,
      });

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        updatedShop: shop,
        healthRestore: item.healthRestore,
        heldItem: equipItem,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `${item.name} @ ${shop.name}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: `Enjoying ${item.name} in Hand!`,
          detail: `+${item.healthRestore} HP · +${item.xp} XP · Served by ${shop.ownerName}`,
          tone: 'emerald',
        },
      });
    });

    socket.on('shop:delete', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const shopId = typeof payload?.shopId === 'string' ? payload.shopId : '';
      const shop = customShopsById.get(shopId);
      if (!shop) return;
      if (!rec.isAdmin && shop.ownerUid !== uid) {
        socket.emit('action:error', { message: 'Only the shop owner or admin can remove this shop.' });
        return;
      }
      customShopsById.delete(shopId);
      io.to(WORLD_ROOM).emit('customShop:deleted', { shopId });
      socket.emit('toast:info', { title: 'Shop Closed', detail: `${shop.name} removed from Green Valley.` });
    });

    // =========================================================================
    // FULL-TIME RUNNING KSRTC PUBLIC BUS · CONDUCTOR SALARY · PASSENGER FARE & TICKETS
    // =========================================================================
    const payoutConductorSalary = (conductorRec: ServerPlayerRecord, reasonLabel: string) => {
      const due = Math.floor(publicBus.conductorEarnedSalary);
      if (due <= 0) return 0;
      publicBus.conductorEarnedSalary = 0;
      conductorRec.greenCoins = clamp(conductorRec.greenCoins + due, 0, 10000000);
      conductorRec.xp = clamp(conductorRec.xp + Math.min(120, due), 0, 1000000);
      conductorRec.level = levelFromXp(conductorRec.xp);
      conductorRec.state.level = conductorRec.level;
      io.to(conductorRec.socketId).emit('economy:update', {
        greenCoins: conductorRec.greenCoins,
        xp: conductorRec.xp,
        level: conductorRec.level,
        tx: {
          type: 'earn',
          amount: due,
          reason: reasonLabel,
          balanceAfter: conductorRec.greenCoins,
        },
        toast: {
          title: `Conductor Salary Paid: +${due} GC!`,
          detail: reasonLabel,
          tone: 'amber',
        },
      });
      return due;
    };

    socket.on('bus:becomeConductor', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (publicBus.conductorUid && publicBus.conductorUid !== uid && playersByUid.has(publicBus.conductorUid)) {
        socket.emit('action:error', {
          message: `${publicBus.conductorName} is currently on Conductor duty. Try again when shift opens!`,
        });
        return;
      }
      // Remove from passengers list if currently riding as passenger
      publicBus.passengers = publicBus.passengers.filter((p) => p.uid !== uid);
      publicBus.conductorUid = uid;
      publicBus.conductorName = rec.state.displayName;
      publicBus.conductorStartedAtMs = Date.now();
      publicBus.conductorEarnedSalary = 0;
      publicBus.conductorFaresCollected = 0;
      publicBus.conductorTicketsIssued = 0;
      busLastSalaryTickMs = Date.now();

      // Release any personal vehicle
      if (rec.state.vehicleId) {
        const oldVeh = vehiclesById.get(rec.state.vehicleId);
        if (oldVeh && oldVeh.driverUid === uid) {
          oldVeh.driverUid = null;
          oldVeh.speed = 0;
          io.to(WORLD_ROOM).emit('vehicle:updated', oldVeh);
        }
        rec.state.vehicleId = null;
      }

      io.to(WORLD_ROOM).emit('bus:update', publicBus);
      socket.emit('toast:info', {
        title: 'On Duty: KSRTC Bus Conductor!',
        detail: `Earning ${CONDUCTOR_SALARY_PER_MIN} GC/min + passenger fares. Issue tickets to passengers!`,
      });
    });

    socket.on('bus:leaveConductor', () => {
      const rec = playersByUid.get(uid);
      if (!rec || publicBus.conductorUid !== uid) return;
      const minsSpent = Math.max(1, Math.round((Date.now() - publicBus.conductorStartedAtMs) / 60000));
      payoutConductorSalary(rec, `KSRTC Conductor Shift Salary (${minsSpent} min on duty)`);
      publicBus.conductorUid = null;
      publicBus.conductorName = '';
      publicBus.conductorStartedAtMs = 0;
      publicBus.conductorEarnedSalary = 0;
      publicBus.conductorFaresCollected = 0;
      publicBus.conductorTicketsIssued = 0;
      io.to(WORLD_ROOM).emit('bus:update', publicBus);
      socket.emit('toast:info', {
        title: 'Conductor Shift Completed',
        detail: 'You stepped off the KSRTC Public Express.',
      });
    });

    socket.on('bus:boardPassenger', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (publicBus.conductorUid === uid) {
        socket.emit('toast:info', { title: 'Already On Bus', detail: 'You are currently the Bus Conductor!' });
        return;
      }
      if (publicBus.passengers.some((p) => p.uid === uid)) {
        socket.emit('bus:update', publicBus);
        return;
      }
      if (rec.state.vehicleId) {
        const oldVeh = vehiclesById.get(rec.state.vehicleId);
        if (oldVeh && oldVeh.driverUid === uid) {
          oldVeh.driverUid = null;
          oldVeh.speed = 0;
          io.to(WORLD_ROOM).emit('vehicle:updated', oldVeh);
        }
        rec.state.vehicleId = null;
      }
      publicBus.passengers.push({
        uid,
        displayName: rec.state.displayName,
        instagramId: rec.state.instagramId,
        paidFare: false,
        hasTicket: false,
        ticketCode: '',
        boardedAtMs: Date.now(),
      });
      io.to(WORLD_ROOM).emit('bus:update', publicBus);
      socket.emit('toast:info', {
        title: 'Boarded KSRTC Public Express!',
        detail: `Pay ${PUBLIC_BUS_FARE} GC fare to get your official ticket from the Conductor.`,
      });
    });

    socket.on('bus:leaveBus', () => {
      const before = publicBus.passengers.length;
      publicBus.passengers = publicBus.passengers.filter((p) => p.uid !== uid);
      if (publicBus.passengers.length !== before) {
        io.to(WORLD_ROOM).emit('bus:update', publicBus);
        socket.emit('toast:info', {
          title: 'Exited KSRTC Bus',
          detail: `Dropped off near ${publicBus.currentStopName}.`,
        });
      }
    });

    socket.on('bus:payFare', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const passenger = publicBus.passengers.find((p) => p.uid === uid);
      if (!passenger) {
        socket.emit('action:error', { message: 'Board the running KSRTC Bus first to pay your fare.' });
        return;
      }
      if (passenger.paidFare) {
        socket.emit('toast:info', { title: 'Fare Already Paid', detail: 'Your bus fare is already paid!' });
        return;
      }
      const cost = rec.isAdmin ? 0 : PUBLIC_BUS_FARE;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', { message: `Need ${PUBLIC_BUS_FARE} GC for bus fare.` });
        return;
      }
      if (cost > 0) rec.greenCoins -= cost;
      passenger.paidFare = true;

      const conductorRec = publicBus.conductorUid ? playersByUid.get(publicBus.conductorUid) : null;
      if (conductorRec && conductorRec.state.uid !== uid) {
        publicBus.conductorFaresCollected += PUBLIC_BUS_FARE;
        conductorRec.greenCoins = clamp(conductorRec.greenCoins + PUBLIC_BUS_FARE, 0, 10000000);
        io.to(conductorRec.socketId).emit('economy:update', {
          greenCoins: conductorRec.greenCoins,
          xp: conductorRec.xp,
          level: conductorRec.level,
          tx: {
            type: 'earn',
            amount: PUBLIC_BUS_FARE,
            reason: `Bus Fare from ${rec.state.displayName}`,
            balanceAfter: conductorRec.greenCoins,
          },
          toast: {
            title: `Bus Fare Received: +${PUBLIC_BUS_FARE} GC`,
            detail: `${rec.state.displayName} paid fare — Issue their ticket now!`,
            tone: 'amber',
          },
        });
      } else {
        // Auto-issue ticket if no live human conductor is currently on duty
        passenger.hasTicket = true;
        passenger.ticketCode = `KSRTC-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      io.to(WORLD_ROOM).emit('bus:update', publicBus);
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: 'KSRTC Public Bus Fare',
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: passenger.hasTicket ? `Ticket Issued: ${passenger.ticketCode}` : 'Fare Paid to Conductor!',
          detail: passenger.hasTicket
            ? 'Auto-ticket issued — enjoy the KSRTC scenic loop!'
            : `Paid ${PUBLIC_BUS_FARE} GC to Conductor ${publicBus.conductorName}. Waiting for ticket!`,
          tone: 'emerald',
        },
      });
    });

    socket.on('bus:issueTicket', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (publicBus.conductorUid !== uid) {
        socket.emit('action:error', { message: 'Only the active Bus Conductor can issue tickets.' });
        return;
      }
      const targetUid = typeof payload?.passengerUid === 'string' ? payload.passengerUid : '';
      const passenger = publicBus.passengers.find((p) => p.uid === targetUid);
      if (!passenger) {
        socket.emit('action:error', { message: 'Passenger is no longer on the bus.' });
        return;
      }
      if (passenger.hasTicket) {
        socket.emit('toast:info', { title: 'Ticket Already Issued', detail: `${passenger.displayName} already holds ${passenger.ticketCode}.` });
        return;
      }

      const ticketCode = `KSRTC-${Math.floor(1000 + Math.random() * 9000)}`;
      passenger.hasTicket = true;
      passenger.ticketCode = ticketCode;
      publicBus.conductorTicketsIssued += 1;

      const bonus = 12;
      rec.greenCoins = clamp(rec.greenCoins + bonus, 0, 10000000);
      rec.xp = clamp(rec.xp + 20, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      io.to(WORLD_ROOM).emit('bus:update', publicBus);
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        tx: {
          type: 'earn',
          amount: bonus,
          reason: `Issued KSRTC Ticket ${ticketCode}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Ticket Issued: ${ticketCode}`,
          detail: `Handed to ${passenger.displayName} (+${bonus} GC bonus · +20 XP)`,
          tone: 'emerald',
        },
      });

      const passRec = playersByUid.get(targetUid);
      if (passRec) {
        io.to(passRec.socketId).emit('toast:info', {
          title: `Official Bus Ticket: ${ticketCode}`,
          detail: `Issued by Conductor ${rec.state.displayName} aboard KSRTC Public Express!`,
        });
      }
    });

    // =========================================================================
    // PUBLIC AD CENTER (Spend Green Coins to Publish Public Ads Across Village)
    // =========================================================================
    socket.on('ads:publish', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const title = sanitizeText(payload?.title, 42);
      const subtitle = sanitizeText(payload?.subtitle, 96);
      const instagramHandle = sanitizeInstagram(payload?.instagramHandle || rec.state.instagramId);
      const accentColor =
        typeof payload?.accentColor === 'string' && HEX_RE.test(payload.accentColor)
          ? payload.accentColor
          : '#f59e0b';

      if (title.length < 2 || subtitle.length < 2) {
        socket.emit('action:error', { message: 'Enter an ad headline and description (min 2 chars each).' });
        return;
      }

      const cost = rec.isAdmin ? 0 : PUBLIC_AD_PUBLISH_COST;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${PUBLIC_AD_PUBLISH_COST} GC to publish a public ad (you have ${rec.greenCoins} GC).`,
        });
        return;
      }

      if (cost > 0) rec.greenCoins -= cost;
      rec.xp = clamp(rec.xp + 60, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      const adId = `ad_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const newAd: PublicAdDef = {
        adId,
        title,
        subtitle,
        instagramHandle,
        accentColor,
        ownerUid: uid,
        ownerName: rec.state.displayName,
        createdAtMs: Date.now(),
      };
      publicAdsById.set(adId, newAd);
      io.to(WORLD_ROOM).emit('publicAd:created', newAd);
      io.to(WORLD_ROOM).emit('chat:message', {
        id: `sys_ad_${Date.now()}`,
        uid: 'system',
        displayName: 'Green Valley Ad Center',
        photoURL: '',
        channel: 'system',
        text: `📢 Public Ad by ${rec.state.displayName}: "${title}" — ${subtitle}${instagramHandle ? ` (@${instagramHandle})` : ''}`,
        timestamp: Date.now(),
      });

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        createdPublicAd: newAd,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `Published Public Ad: ${title}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: 'Public Ad Published Live!',
          detail: `"${title}" is now broadcasting across Green Valley billboards & HUD!`,
          tone: 'amber',
        },
      });
    });

    // =========================================================================
    // ACTIVE BUILDING INTERIOR SERVICES (Hospital, Gym Body Building, Park, Ad Center, Mall, Bank, etc.)
    // =========================================================================
    socket.on('building:service', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const buildingId = typeof payload?.buildingId === 'string' ? payload.buildingId : '';
      const serviceId = typeof payload?.serviceId === 'string' ? payload.serviceId : '';
      const bldg = ACTIVE_BUILDINGS.find((b) => b.id === buildingId);
      const svc = bldg?.services.find((s) => s.id === serviceId);
      if (!bldg || !svc) return;

      const now = Date.now();
      if ((svc.rewardCoins || 0) > 0) {
        const cdKey = `${buildingId}:${serviceId}`;
        const readyAt = rec.buildingCooldowns.get(cdKey) || 0;
        if (now < readyAt) {
          const secs = Math.ceil((readyAt - now) / 1000);
          socket.emit('action:error', { message: `This service payout is ready again in ${secs}s.` });
          return;
        }
        rec.buildingCooldowns.set(cdKey, now + 35000);
      }

      const cost = rec.isAdmin ? 0 : svc.cost;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', { message: `Need ${svc.cost} GC for ${svc.label}.` });
        return;
      }

      const gain = svc.rewardCoins || 0;
      rec.greenCoins = clamp(rec.greenCoins - cost + gain, 0, 10000000);
      rec.xp = clamp(rec.xp + (svc.rewardXp || 0), 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      let muscleChanged = false;
      if (svc.muscleGain && svc.muscleGain > 0) {
        rec.muscleLevel = clamp(rec.muscleLevel + svc.muscleGain, 0, 10);
        rec.state.muscleLevel = rec.muscleLevel;
        muscleChanged = true;
        io.to(WORLD_ROOM).emit('player:appearance', {
          uid,
          displayName: rec.state.displayName,
          instagramId: rec.state.instagramId,
          age: rec.age,
          relationshipStatus: rec.relationshipStatus,
          muscleLevel: rec.muscleLevel,
          appearance: rec.state.appearance,
          isAdmin: rec.isAdmin,
        });
      }

      if (svc.heldItem && VALID_HELD_ITEMS.has(svc.heldItem)) {
        const nowHold = Date.now();
        rec.state.heldItem = svc.heldItem;
        rec.state.heldItemUntil = nowHold + 12000;
        rec.state.anim = svc.heldItem === 'snack' ? 'eat' : 'drink';
        rec.state.emoteUntil = nowHold + 4200;
        io.to(WORLD_ROOM).emit('player:heldItem', {
          uid,
          heldItem: svc.heldItem,
          heldItemUntil: rec.state.heldItemUntil,
          anim: rec.state.anim,
        });
      }

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ...(muscleChanged ? { muscleLevel: rec.muscleLevel } : {}),
        healthRestore: svc.healthRestore,
        teleportTo: svc.teleportTo,
        ...(cost > 0
          ? {
              tx: {
                type: 'spend' as const,
                amount: cost,
                reason: `${bldg.name}: ${svc.label}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : gain > 0
            ? {
                tx: {
                  type: 'earn' as const,
                  amount: gain,
                  reason: `${bldg.name}: ${svc.label}`,
                  balanceAfter: rec.greenCoins,
                },
              }
            : {}),
        toast: {
          title: muscleChanged ? `Body Built! Muscle Lv.${rec.muscleLevel}/10` : svc.label,
          detail:
            muscleChanged
              ? `${svc.label} · Your 3D physique grew stronger! (+${svc.rewardXp || 0} XP)`
              : gain > 0
                ? `+${gain} GC${svc.rewardXp ? ` · +${svc.rewardXp} XP` : ''}`
                : svc.teleportLabel
                  ? `Arriving at ${svc.teleportLabel}`
                  : svc.healthRestore
                    ? `Health restored (+${svc.healthRestore} HP)`
                    : bldg.name,
          tone: gain > 0 ? 'amber' : 'emerald',
        },
      });
    });

    // =========================================================================
    // FREE SINGLE-TO-MINGLE: Live 3D Screen, Max 5-Min Timer + Admin Reset,
    // Smart Gender-Specific Decline Re-Selection, Food to ALL & Free Honeymoon
    // =========================================================================
    const broadcastMingleToAll = () => {
      for (const p of playersByUid.values()) {
        io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
      }
    };

    const assignPairAndBroadcast = (
      partA: MingleParticipant,
      partB: MingleParticipant,
      matchId: string,
      loc: { name: string; pos: { x: number; y: number; z: number } },
      opts?: { aAccepted?: boolean; bAccepted?: boolean; replacedGender?: 'male' | 'female' },
    ) => {
      const aAccepted = Boolean(opts?.aAccepted || partA.isNpc);
      const bAccepted = Boolean(opts?.bAccepted || partB.isNpc);
      const recA = !partA.isNpc ? playersByUid.get(partA.uid) : null;
      const recB = !partB.isNpc ? playersByUid.get(partB.uid) : null;

      if (recA) {
        recA.activeMingleMatch = {
          matchId,
          partnerUid: partB.uid,
          partnerName: partB.displayName,
          partnerInstagram: partB.instagramId,
          partnerPhotoURL: partB.photoURL,
          partnerAppearance: partB.appearance,
          partnerAge: partB.age,
          partnerGender: partB.gender,
          isNpcPartner: Boolean(partB.isNpc),
          myAccepted: aAccepted,
          partnerAccepted: bAccepted,
          status: 'proposed',
        };
      }
      if (recB) {
        recB.activeMingleMatch = {
          matchId,
          partnerUid: partA.uid,
          partnerName: partA.displayName,
          partnerInstagram: partA.instagramId,
          partnerPhotoURL: partA.photoURL,
          partnerAppearance: partA.appearance,
          partnerAge: partA.age,
          partnerGender: partA.gender,
          isNpcPartner: Boolean(partA.isNpc),
          myAccepted: bAccepted,
          partnerAccepted: aAccepted,
          status: 'proposed',
        };
      }

      currentSelectedPair = {
        matchId,
        memberA: partA,
        memberB: partB,
        selectedAt: Date.now(),
        locationName: loc.name,
        locationPos: loc.pos,
        status: 'proposed',
        memberAAccepted: aAccepted,
        memberBAccepted: bAccepted,
        lastReplacedGender: opts?.replacedGender,
      };
      mingleNextEventAtMs = Date.now() + MINGLE_MAX_ROUND_MS;
      broadcastMingleToAll();
    };

    const autoSelectTwoAccountsFromScreen = (requester?: ServerPlayerRecord) => {
      const joinedRecords: ServerPlayerRecord[] = [];
      for (const joinedUid of mingleJoinedAt.keys()) {
        const r = playersByUid.get(joinedUid);
        if (r) joinedRecords.push(r);
      }
      if (requester && !mingleJoinedAt.has(requester.state.uid)) {
        mingleJoinedAt.set(requester.state.uid, Date.now());
        joinedRecords.push(requester);
      }
      if (joinedRecords.length === 0) return;

      const shuffled = [...joinedRecords].sort(() => Math.random() - 0.5);
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      const matchId = `mingle_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      let partA: MingleParticipant;
      let partB: MingleParticipant;

      if (shuffled.length >= 2) {
        const men = shuffled.filter((r) => r.state.appearance.gender === 'male');
        const women = shuffled.filter((r) => r.state.appearance.gender === 'female');
        if (men.length > 0 && women.length > 0) {
          partA = toMingleParticipant(men[0]);
          partB = toMingleParticipant(women[0]);
        } else {
          partA = toMingleParticipant(shuffled[0]);
          partB = toMingleParticipant(shuffled[1]);
        }
      } else {
        partA = toMingleParticipant(shuffled[0]);
        const wantedGender = partA.gender === 'male' ? 'female' : 'male';
        const pool = VALLEY_SINGLES.filter((n) => n.gender === wantedGender);
        const pick = pool[Math.floor(Math.random() * pool.length)] || VALLEY_SINGLES[0];
        partB = npcToMingleParticipant(pick);
      }

      assignPairAndBroadcast(partA, partB, matchId, loc);
      io.to(WORLD_ROOM).emit('toast:info', {
        title: 'Live Screen Selected 2 Members (FREE)!',
        detail: `${partA.displayName} ♥ ${partB.displayName} — DPs live on Mingle Screen!`,
      });
      io.to(WORLD_ROOM).emit('chat:message', {
        id: `sys_mingle_${Date.now()}`,
        uid: 'system',
        displayName: 'Mingle Live Screen',
        photoURL: '',
        channel: 'system',
        text: `💘 Live Mingle Screen selected ${partA.displayName} (@${partA.instagramId || 'valley'}) ♥ ${partB.displayName} (@${partB.instagramId || 'valley'})!`,
        timestamp: Date.now(),
      });
    };

    socket.on('mingle:join', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (!mingleJoinedAt.has(uid)) {
        mingleJoinedAt.set(uid, Date.now());
      }
      broadcastMingleToAll();
      socket.emit('toast:info', {
        title: 'Joined Single-to-Mingle (FREE)!',
        detail: 'Your Name & ID are now live on the 3D Mingle Screen.',
      });
    });

    socket.on('mingle:leave', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      mingleJoinedAt.delete(uid);
      broadcastMingleToAll();
      socket.emit('toast:info', {
        title: 'Left Single-to-Mingle Pool',
        detail: 'You can rejoin anytime for free.',
      });
    });

    socket.on('mingle:autoSelect', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      autoSelectTwoAccountsFromScreen(rec);
    });

    // Admin Reset for Max 5-Minute Mingle Timer & Active Round
    socket.on('mingle:adminReset', () => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Only Admin can reset the Single-to-Mingle timer.' });
        return;
      }
      mingleNextEventAtMs = Date.now() + MINGLE_MAX_ROUND_MS;
      mingleAlarmSentForRound = 0;
      currentSelectedPair = null;
      for (const p of playersByUid.values()) {
        p.activeMingleMatch = null;
      }
      broadcastMingleToAll();
      io.to(WORLD_ROOM).emit('toast:info', {
        title: 'Admin Reset Single-to-Mingle!',
        detail: 'Fresh 5-minute Mingle countdown started — ready for new selections!',
      });
    });

    socket.on('mingle:triggerDemo', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const mode = payload?.mode === 'alarm' ? 'alarm' : 'match';
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      if (mode === 'alarm') {
        mingleNextEventAtMs = Date.now() + 60 * 1000;
        io.to(WORLD_ROOM).emit('mingle:alarm', {
          locationName: loc.name,
          locationPos: loc.pos,
          nextEventAtMs: mingleNextEventAtMs,
        });
        broadcastMingleToAll();
      } else {
        autoSelectTwoAccountsFromScreen(rec);
      }
    });

    socket.on('mingle:respond', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.activeMingleMatch) return;
      const accept = payload?.accept === true;
      const match = rec.activeMingleMatch;
      const partnerRec = !match.isNpcPartner ? playersByUid.get(match.partnerUid) : null;

      // SMART GENDER-SPECIFIC DECLINE:
      // If BOY declines -> keep the GIRL the same and auto-select ONLY a new BOY!
      // If GIRL declines -> keep the BOY the same and auto-select ONLY a new GIRL!
      if (!accept) {
        const declinerGender = rec.state.appearance.gender;
        const pair = currentSelectedPair && currentSelectedPair.matchId === match.matchId ? currentSelectedPair : null;
        rec.activeMingleMatch = null;

        if (pair) {
          const declinerIsA = pair.memberA.uid === uid;
          const keptMember = declinerIsA ? pair.memberB : pair.memberA;
          const keptWasAccepted = declinerIsA ? pair.memberBAccepted : pair.memberAAccepted;

          // Pick a replacement of the SAME gender as the person who declined (excluding decliner & kept member)
          const joinedSameGender: ServerPlayerRecord[] = [];
          for (const joinedUid of mingleJoinedAt.keys()) {
            if (joinedUid === uid || joinedUid === keptMember.uid) continue;
            const candidate = playersByUid.get(joinedUid);
            if (candidate && candidate.state.appearance.gender === declinerGender) {
              joinedSameGender.push(candidate);
            }
          }

          let replacement: MingleParticipant;
          if (joinedSameGender.length > 0) {
            const pickRec = joinedSameGender[Math.floor(Math.random() * joinedSameGender.length)];
            replacement = toMingleParticipant(pickRec);
          } else {
            const npcPool = VALLEY_SINGLES.filter(
              (n) => n.gender === declinerGender && n.uid !== keptMember.uid,
            );
            const npcPick = npcPool[Math.floor(Math.random() * npcPool.length)] || VALLEY_SINGLES[0];
            replacement = npcToMingleParticipant(npcPick);
          }

          const loc = { name: pair.locationName, pos: pair.locationPos };
          const nextMatchId = `mingle_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const nextA = declinerIsA ? replacement : keptMember;
          const nextB = declinerIsA ? keptMember : replacement;

          assignPairAndBroadcast(nextA, nextB, nextMatchId, loc, {
            aAccepted: declinerIsA ? Boolean(replacement.isNpc) : keptWasAccepted,
            bAccepted: declinerIsA ? keptWasAccepted : Boolean(replacement.isNpc),
            replacedGender: declinerGender,
          });

          const roleLabel = declinerGender === 'male' ? 'Boy' : 'Girl';
          const keptRoleLabel = keptMember.gender === 'male' ? 'Boy' : 'Girl';
          io.to(WORLD_ROOM).emit('toast:info', {
            title: `${roleLabel} Declined — New ${roleLabel} Selected!`,
            detail: `${keptMember.displayName} (${keptRoleLabel}) stayed · Now matched with ${replacement.displayName}!`,
          });
          io.to(WORLD_ROOM).emit('chat:message', {
            id: `sys_repick_${Date.now()}`,
            uid: 'system',
            displayName: 'Mingle Live Screen',
            photoURL: '',
            channel: 'system',
            text: `🔄 ${rec.state.displayName} declined — keeping ${keptMember.displayName} and selecting new ${roleLabel}: ${replacement.displayName}!`,
            timestamp: Date.now(),
          });
          return;
        }

        if (partnerRec && partnerRec.activeMingleMatch?.matchId === match.matchId) {
          partnerRec.activeMingleMatch = null;
        }
        currentSelectedPair = null;
        broadcastMingleToAll();
        socket.emit('toast:info', { title: 'Match Declined', detail: 'Waiting for the next free auto-select round.' });
        return;
      }

      match.myAccepted = true;
      if (partnerRec && partnerRec.activeMingleMatch?.matchId === match.matchId) {
        partnerRec.activeMingleMatch.partnerAccepted = true;
      }
      if (currentSelectedPair?.matchId === match.matchId) {
        if (currentSelectedPair.memberA.uid === uid) currentSelectedPair.memberAAccepted = true;
        if (currentSelectedPair.memberB.uid === uid) currentSelectedPair.memberBAccepted = true;
      }

      const bothAccepted = match.myAccepted && (match.isNpcPartner || match.partnerAccepted);
      if (!bothAccepted) {
        broadcastMingleToAll();
        if (partnerRec) {
          io.to(partnerRec.socketId).emit('toast:info', {
            title: `${rec.state.displayName} Said YES!`,
            detail: 'Open Single-to-Mingle to accept & celebrate your FREE Marriage!',
          });
        }
        return;
      }

      // Celebrate FREE Grand Marriage Ceremony + AUTOMATIC FOOD TO ALL PLAYERS + FREE HONEYMOON!
      if (currentSelectedPair?.matchId === match.matchId) {
        currentSelectedPair.status = 'married';
        currentSelectedPair.memberAAccepted = true;
        currentSelectedPair.memberBAccepted = true;
        currentSelectedPair.feastServed = true;
      }

      const coupleUids = new Set<string>([uid]);
      if (partnerRec) coupleUids.add(partnerRec.state.uid);

      const finalizeMarriage = (p: ServerPlayerRecord, pPartnerName: string, pPartnerUid: string, pPartnerIg: string) => {
        if (p.activeMingleMatch) {
          p.activeMingleMatch.status = 'married';
          p.activeMingleMatch.myAccepted = true;
          p.activeMingleMatch.partnerAccepted = true;
          p.activeMingleMatch.feastServed = true;
        }
        p.relationshipStatus = 'married';
        p.partnerName = pPartnerName;
        p.state.relationshipStatus = 'married';
        p.state.partnerName = pPartnerName;
        p.xp = clamp(p.xp + 220, 0, 1000000);
        p.level = levelFromXp(p.xp);
        p.state.level = p.level;

        io.to(p.socketId).emit('mingle:married', {
          partnerUid: pPartnerUid,
          partnerName: pPartnerName,
          partnerInstagram: pPartnerIg,
          mingleEvent: buildMingleStateForPlayer(p),
        });
        io.to(p.socketId).emit('economy:update', {
          greenCoins: p.greenCoins,
          xp: p.xp,
          level: p.level,
          healthRestore: 100,
          teleportTo: { x: -110, y: 0, z: -14 },
          toast: {
            title: `Just Married: ${p.state.displayName} ♥ ${pPartnerName}!`,
            detail: 'Wedding Food served to ALL + FREE Lakeside Honeymoon Unlocked!',
            tone: 'rose',
          },
        });
      };

      finalizeMarriage(rec, match.partnerName, match.partnerUid, match.partnerInstagram);
      if (partnerRec) {
        finalizeMarriage(partnerRec, rec.state.displayName, rec.state.uid, rec.state.instagramId);
      }

      // Serve FREE Wedding Food (Kerala Sadhya & Malabar Biryani) to ALL other online players automatically!
      for (const guest of playersByUid.values()) {
        if (coupleUids.has(guest.state.uid)) continue;
        guest.xp = clamp(guest.xp + 60, 0, 1000000);
        guest.level = levelFromXp(guest.xp);
        guest.state.level = guest.level;
        io.to(guest.socketId).emit('economy:update', {
          greenCoins: guest.greenCoins,
          xp: guest.xp,
          level: guest.level,
          healthRestore: 100,
          toast: {
            title: `Wedding Food Served To All! 🍛`,
            detail: `${rec.state.displayName} ♥ ${match.partnerName} got married — Free Sadhya & Biryani (+100 HP · +60 XP)!`,
            tone: 'amber',
          },
        });
      }

      broadcastMingleToAll();

      io.to(WORLD_ROOM).emit('chat:message', {
        id: `sys_wed_${Date.now()}`,
        uid: 'system',
        displayName: 'Green Valley Wedding Bell',
        photoURL: '',
        channel: 'system',
        text: `🎉 ${rec.state.displayName} ♥ ${match.partnerName} just got MARRIED! FREE Wedding Sadhya & Biryani food served to EVERY player + FREE Honeymoon unlocked!`,
        timestamp: Date.now(),
      });
    });

    socket.on('mingle:feast', () => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.activeMingleMatch) return;
      rec.activeMingleMatch.feastServed = true;
      if (currentSelectedPair?.matchId === rec.activeMingleMatch.matchId) {
        currentSelectedPair.feastServed = true;
      }
      broadcastMingleToAll();
      // Serve food to ALL online players across Green Valley!
      for (const p of playersByUid.values()) {
        p.xp = clamp(p.xp + 80, 0, 1000000);
        p.level = levelFromXp(p.xp);
        p.state.level = p.level;
        io.to(p.socketId).emit('economy:update', {
          greenCoins: p.greenCoins,
          xp: p.xp,
          level: p.level,
          healthRestore: 100,
          toast: {
            title: 'Wedding Feast Served To Everyone! 🍛',
            detail: `Complimentary Kerala Sadhya, Biryani & Payasam from ${rec.state.displayName}'s Wedding (+100 HP · +80 XP)`,
            tone: 'amber',
          },
        });
      }
    });

    socket.on('mingle:honeymoon', () => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.activeMingleMatch) return;
      const match = rec.activeMingleMatch;
      match.status = 'honeymoon';
      if (currentSelectedPair?.matchId === match.matchId) {
        currentSelectedPair.status = 'honeymoon';
      }
      const partnerRec = !match.isNpcPartner ? playersByUid.get(match.partnerUid) : null;
      if (partnerRec && partnerRec.activeMingleMatch?.matchId === match.matchId) {
        partnerRec.activeMingleMatch.status = 'honeymoon';
        io.to(partnerRec.socketId).emit('economy:update', {
          greenCoins: partnerRec.greenCoins,
          xp: partnerRec.xp,
          level: partnerRec.level,
          healthRestore: 100,
          teleportTo: { x: -78, y: 0, z: 112 },
          toast: {
            title: 'Free Lakeside Honeymoon Resort!',
            detail: `Complimentary Golden Hour Suite with ${rec.state.displayName} ♥`,
            tone: 'rose',
          },
        });
      }
      rec.xp = clamp(rec.xp + 150, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;
      broadcastMingleToAll();
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        healthRestore: 100,
        teleportTo: { x: -78, y: 0, z: 112 },
        toast: {
          title: 'Free Lakeside Honeymoon Resort!',
          detail: `Complimentary Romantic Sunset Suite with ${match.partnerName} ♥ (0 GC)`,
          tone: 'rose',
        },
      });
    });

    // =========================================================================
    // HASHIM'S VILLA & RIFAD'S VILLA — GRAND WALLED PALACES
    // =========================================================================
    socket.on('villa:visitOutside', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const villaId = typeof payload?.villaId === 'string' ? payload.villaId : '';
      const villa = palaceVillasById.get(villaId);
      if (!villa) return;

      const ownerOrAdmin = isVillaOwner(rec, villa);
      if (rec.visitedVillaIds.has(villaId) || ownerOrAdmin) {
        rec.visitedVillaIds.add(villaId);
        socket.emit('villa:accessUpdate', {
          villaId,
          canVisitOutside: true,
          canEnterInside: ownerOrAdmin || rec.unlockedVillaIds.has(villaId),
        });
        socket.emit('toast:info', {
          title: `Welcome to ${villa.boardName}`,
          detail: ownerOrAdmin ? 'Owner/Admin VIP Courtyard Entry' : 'Courtyard gate unlocked!',
        });
        return;
      }

      if (rec.greenCoins < villa.visitFee) {
        socket.emit('action:error', {
          message: `Need ${villa.visitFee} GC visitor ticket to enter ${villa.boardName} grounds.`,
        });
        return;
      }
      rec.greenCoins -= villa.visitFee;
      rec.visitedVillaIds.add(villaId);

      socket.emit('villa:accessUpdate', {
        villaId,
        canVisitOutside: true,
        canEnterInside: false,
      });
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        tx: {
          type: 'spend',
          amount: villa.visitFee,
          reason: `Visitor Pass: ${villa.boardName} Grounds`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Entered ${villa.boardName} Grounds!`,
          detail: `Courtyard open · Entering inside the palace requires the Secret Key.`,
          tone: 'amber',
        },
      });
    });

    socket.on('villa:unlockHouse', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const villaId = typeof payload?.villaId === 'string' ? payload.villaId : '';
      const rawKey = typeof payload?.key === 'string' ? payload.key.trim() : '';
      const villa = palaceVillasById.get(villaId);
      if (!villa) return;

      const ownerOrAdmin = isVillaOwner(rec, villa);
      if (ownerOrAdmin) {
        rec.visitedVillaIds.add(villaId);
        rec.unlockedVillaIds.add(villaId);
        socket.emit('villa:accessUpdate', { villaId, canVisitOutside: true, canEnterInside: true });
        socket.emit('toast:info', {
          title: `Inside ${villa.boardName}`,
          detail: 'Verified Owner/Admin Palace Access granted!',
        });
        return;
      }

      if (!villa.hasKeySet || !villa.keyHash) {
        socket.emit('action:error', {
          message: `The owner (@${villa.ownerUsername}) has not set a public entry key for ${villa.boardName} yet.`,
        });
        return;
      }

      if (!rawKey || !verifySecretScrypt(rawKey, villa.keySalt, villa.keyHash)) {
        socket.emit('action:error', {
          message: `Incorrect Secret Key for ${villa.boardName}! Interior access denied.`,
        });
        return;
      }

      rec.visitedVillaIds.add(villaId);
      rec.unlockedVillaIds.add(villaId);
      socket.emit('villa:accessUpdate', { villaId, canVisitOutside: true, canEnterInside: true });
      socket.emit('toast:info', {
        title: `Palace Doors Unlocked!`,
        detail: `Welcome inside ${villa.boardName}!`,
      });
    });

    socket.on('villa:updateConfig', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const villaId = typeof payload?.villaId === 'string' ? payload.villaId : '';
      const villa = palaceVillasById.get(villaId);
      if (!villa) return;
      if (!isVillaOwner(rec, villa)) {
        socket.emit('action:error', {
          message: `Only @${villa.ownerUsername} or Admin can rename or change the key of ${villa.boardName}.`,
        });
        return;
      }

      const nextName = typeof payload?.boardName === 'string' ? sanitizeText(payload.boardName, 36) : '';
      if (nextName.length >= 2) {
        villa.boardName = nextName;
      }
      const nextKey = typeof payload?.newKey === 'string' ? payload.newKey.trim() : '';
      if (nextKey.length > 0) {
        if (nextKey.length < 4 || nextKey.length > 24) {
          socket.emit('action:error', { message: 'Villa secret key must be 4–24 characters.' });
          return;
        }
        villa.keySalt = crypto.randomBytes(16).toString('hex');
        villa.keyHash = hashSecretScrypt(nextKey, villa.keySalt);
        villa.hasKeySet = true;
      }

      io.to(WORLD_ROOM).emit('villa:updated', toPublicVilla(villa));
      socket.emit('toast:info', {
        title: `${villa.boardName} Updated!`,
        detail: nextKey ? 'Signboard & Secret Palace Key saved.' : 'Palace signboard updated live!',
      });
    });

    // =========================================================================
    // PERSONAL SMARTPHONE: PRIVATE 1-ON-1 CALLS & ADMIN TYPIXEL ALERTS
    // =========================================================================
    socket.on('phone:call', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const targetUid = typeof payload?.targetUid === 'string' ? payload.targetUid : '';
      const target = targetUid && targetUid !== uid ? playersByUid.get(targetUid) : null;
      if (!target) {
        socket.emit('action:error', { message: 'That citizen is not online right now.' });
        return;
      }
      const callId = `call_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      activePhoneCalls.set(callId, {
        callId,
        callerUid: uid,
        calleeUid: targetUid,
        status: 'ringing',
        startedAtMs: Date.now(),
      });
      socket.emit('phone:state', {
        callId,
        peerUid: targetUid,
        peerName: target.state.displayName,
        peerInstagram: target.state.instagramId,
        status: 'ringing_out',
      });
      io.to(target.socketId).emit('phone:state', {
        callId,
        peerUid: uid,
        peerName: rec.state.displayName,
        peerInstagram: rec.state.instagramId,
        status: 'ringing_in',
      });
    });

    socket.on('phone:accept', (payload: Record<string, unknown>) => {
      const callId = typeof payload?.callId === 'string' ? payload.callId : '';
      const call = activePhoneCalls.get(callId);
      if (!call || call.calleeUid !== uid) return;
      call.status = 'active';
      call.startedAtMs = Date.now();
      const caller = playersByUid.get(call.callerUid);
      const callee = playersByUid.get(call.calleeUid);
      if (caller && callee) {
        io.to(caller.socketId).emit('phone:state', {
          callId,
          peerUid: callee.state.uid,
          peerName: callee.state.displayName,
          peerInstagram: callee.state.instagramId,
          status: 'active',
          startedAtMs: call.startedAtMs,
        });
        io.to(callee.socketId).emit('phone:state', {
          callId,
          peerUid: caller.state.uid,
          peerName: caller.state.displayName,
          peerInstagram: caller.state.instagramId,
          status: 'active',
          startedAtMs: call.startedAtMs,
        });
      }
    });

    socket.on('phone:decline', (payload: Record<string, unknown>) => {
      const callId = typeof payload?.callId === 'string' ? payload.callId : '';
      const call = activePhoneCalls.get(callId);
      if (!call) return;
      if (call.callerUid !== uid && call.calleeUid !== uid) return;
      activePhoneCalls.delete(callId);
      const caller = playersByUid.get(call.callerUid);
      const callee = playersByUid.get(call.calleeUid);
      if (caller) io.to(caller.socketId).emit('phone:ended', { callId, reason: 'Call declined' });
      if (callee) io.to(callee.socketId).emit('phone:ended', { callId, reason: 'Call declined' });
    });

    socket.on('phone:end', (payload: Record<string, unknown>) => {
      const callId = typeof payload?.callId === 'string' ? payload.callId : '';
      const call = activePhoneCalls.get(callId);
      if (!call) return;
      if (call.callerUid !== uid && call.calleeUid !== uid) return;
      activePhoneCalls.delete(callId);
      const caller = playersByUid.get(call.callerUid);
      const callee = playersByUid.get(call.calleeUid);
      if (caller) io.to(caller.socketId).emit('phone:ended', { callId, reason: 'Call ended' });
      if (callee) io.to(callee.socketId).emit('phone:ended', { callId, reason: 'Call ended' });
    });

    socket.on('admin:publishUpdate', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Admin privileges required.' });
        return;
      }
      const title = sanitizeText(payload?.title, 60);
      const message = sanitizeText(payload?.message, 260);
      if (title.length < 2 || message.length < 2) {
        socket.emit('action:error', { message: 'Enter an update headline and message.' });
        return;
      }
      const alert: TypixelUpdateAlert = {
        id: `upd_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        title,
        message,
        createdAtMs: Date.now(),
        author: rec.state.displayName,
      };
      typixelUpdates.unshift(alert);
      if (typixelUpdates.length > 25) typixelUpdates.pop();
      io.to(WORLD_ROOM).emit('typixel:update', alert);
    });

    // =========================================================================
    // ADMIN: EXPAND VILLAGE SIZE & MANAGE SHOP SPACE / LOCATION
    // =========================================================================
    socket.on('admin:expandVillage', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Admin privileges required.' });
        return;
      }
      const requested = Number(payload?.halfSize);
      if (!Number.isFinite(requested)) return;
      villageHalfSize = clamp(Math.round(requested), 420, MAX_WORLD_HALF_SIZE);
      io.to(WORLD_ROOM).emit('village:config', { halfSize: villageHalfSize });
      io.to(WORLD_ROOM).emit('toast:info', {
        title: `Village Expanded to ${villageHalfSize * 2}m × ${villageHalfSize * 2}m!`,
        detail: 'Admin increased Green Valley land area for new homes & shops.',
      });
    });

    socket.on('admin:updateShopSpace', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec || !rec.isAdmin) {
        socket.emit('action:error', { message: 'Admin privileges required.' });
        return;
      }
      const shopId = typeof payload?.shopId === 'string' ? payload.shopId : '';
      const shop = customShopsById.get(shopId);
      if (!shop) {
        socket.emit('action:error', { message: 'Shop not found.' });
        return;
      }
      const nextTier: ShopSizeTier = VALID_SHOP_TIERS.has(String(payload?.sizeTier) as ShopSizeTier)
        ? (payload.sizeTier as ShopSizeTier)
        : shop.sizeTier || 'small';
      const nextX = typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : shop.x;
      const nextZ = typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : shop.z;
      const check = isPositionOnRoad(nextX, nextZ, nextTier === 'palace' ? 18 : 13);
      if (check.onRoad) {
        socket.emit('action:error', { message: check.reason || 'Cannot move shop onto a road.' });
        return;
      }
      shop.sizeTier = nextTier;
      shop.x = Number(clamp(nextX, -villageHalfSize + 20, villageHalfSize - 20).toFixed(1));
      shop.z = Number(clamp(nextZ, -villageHalfSize + 20, villageHalfSize - 20).toFixed(1));
      shop.y = Number(Math.max(0, groundHeightAt(shop.x, shop.z)).toFixed(2));
      io.to(WORLD_ROOM).emit('customShop:updated', shop);
      socket.emit('toast:info', {
        title: `Updated Shop Space: ${shop.name}`,
        detail: `Size: ${nextTier.toUpperCase()} at (${Math.round(shop.x)}, ${Math.round(shop.z)})`,
      });
    });

    // =========================================================================
    // VISIBLE HELD ITEMS + PLAYABLE 3D FOOTBALL & VOLLEYBALL + 50+ GAME CENTER
    // =========================================================================
    socket.on('player:holdItem', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const item = String(payload?.heldItem || 'none') as HeldItemType;
      if (!VALID_HELD_ITEMS.has(item)) return;
      const nowHold = Date.now();
      rec.state.heldItem = item;
      rec.state.heldItemUntil = item === 'none' ? undefined : nowHold + 15000;
      const anim: AnimationState = item === 'snack' ? 'eat' : item === 'tea' || item === 'latte' || item === 'juice' ? 'drink' : 'idle';
      if (anim === 'drink' || anim === 'eat') {
        rec.state.anim = anim;
        rec.state.emoteUntil = nowHold + 4000;
      }
      io.to(WORLD_ROOM).emit('player:heldItem', {
        uid,
        heldItem: item,
        heldItemUntil: rec.state.heldItemUntil,
        anim: rec.state.anim,
      });
    });

    socket.on('sports:kick', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const ballId = payload?.ballId === 'volleyball' ? 'volleyball' : 'football';
      const ball = sportsBalls[ballId];
      const dist = Math.hypot(rec.state.x - ball.x, rec.state.z - ball.z);
      if (dist > 8) return;
      const dirX = typeof payload?.dirX === 'number' && Number.isFinite(payload.dirX) ? payload.dirX : Math.sin(rec.state.rotY);
      const dirZ = typeof payload?.dirZ === 'number' && Number.isFinite(payload.dirZ) ? payload.dirZ : Math.cos(rec.state.rotY);
      const len = Math.hypot(dirX, dirZ) || 1;
      const power = ballId === 'volleyball' ? 11.5 : 17.5;
      ball.vx = (dirX / len) * power;
      ball.vz = (dirZ / len) * power;
      ball.vy = ballId === 'volleyball' ? 11.2 : 5.4;
    });

    socket.on('gameCenter:collectCard', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (rec.hasGameCenterCard) {
        socket.emit('toast:info', {
          title: 'VIP Card Already Collected',
          detail: 'You already hold the Grand Game Center Entrance Card!',
        });
        return;
      }
      const dist = Math.hypot(rec.state.x - HIDDEN_CARD_POS.x, rec.state.z - HIDDEN_CARD_POS.z);
      if (!rec.isAdmin && dist > 14) {
        socket.emit('action:error', {
          message: 'Climb all the way to the high-risk cliff summit to pick up the Hidden Entrance Card!',
        });
        return;
      }
      rec.hasGameCenterCard = true;
      rec.xp = clamp(rec.xp + 200, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        hasGameCenterCard: true,
        toast: {
          title: 'Collected Hidden VIP Entrance Card!',
          detail: 'Grand Game Center (50+ Games) is now permanently unlocked at cheap rates!',
          tone: 'amber',
        },
      });
    });

    socket.on('gameCenter:play', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      if (!rec.hasGameCenterCard && !rec.isAdmin) {
        socket.emit('action:error', {
          message: 'Collect the Hidden VIP Entrance Card from Danger Peak Cliff before playing!',
        });
        return;
      }
      const gameId = typeof payload?.gameId === 'string' ? payload.gameId : '';
      const won = payload?.won === true;
      const game = GAME_CENTER_GAMES.find((g) => g.id === gameId);
      if (!game) return;

      const fee = rec.isAdmin ? 0 : game.entryFee;
      if (fee > 0 && rec.greenCoins < fee) {
        socket.emit('action:error', {
          message: `Need ${game.entryFee} GC to play ${game.title}.`,
        });
        return;
      }
      const prize = won ? game.winPrize : 0;
      rec.greenCoins = clamp(rec.greenCoins - fee + prize, 0, 10000000);
      const gainXp = won ? 25 : 8;
      rec.xp = clamp(rec.xp + gainXp, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;

      const net = prize - fee;
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        tx: {
          type: net >= 0 ? 'earn' : 'spend',
          amount: Math.abs(net || fee),
          reason: won ? `Won ${game.title}` : `Played ${game.title}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: won ? `Arcade Win: +${prize} GC!` : `Played ${game.title}`,
          detail: won
            ? `Entry: ${fee} GC · Prize: +${prize} GC · +${gainXp} XP`
            : `Entry: -${fee} GC · Better luck next round!`,
          tone: won ? 'emerald' : 'sky',
        },
      });
    });

    socket.on('disconnect', () => {
      const disconnectedUid = uidBySocketId.get(socket.id);
      uidBySocketId.delete(socket.id);
      if (!disconnectedUid) return;

      const rec = playersByUid.get(disconnectedUid);
      if (rec && rec.socketId === socket.id) {
        if (rec.voiceActive) {
          io.to(WORLD_ROOM).emit('voice:user-left', { uid: disconnectedUid });
        }
        if (rec.state.vehicleId) {
          const veh = vehiclesById.get(rec.state.vehicleId);
          if (veh && veh.driverUid === disconnectedUid) {
            veh.driverUid = null;
            veh.speed = 0;
            io.to(WORLD_ROOM).emit('vehicle:updated', veh);
          }
        }
        if (publicBus.conductorUid === disconnectedUid) {
          publicBus.conductorUid = null;
          publicBus.conductorName = '';
          publicBus.conductorStartedAtMs = 0;
          publicBus.conductorEarnedSalary = 0;
          io.to(WORLD_ROOM).emit('bus:update', publicBus);
        }
        const beforePass = publicBus.passengers.length;
        publicBus.passengers = publicBus.passengers.filter((p) => p.uid !== disconnectedUid);
        if (publicBus.passengers.length !== beforePass) {
          io.to(WORLD_ROOM).emit('bus:update', publicBus);
        }

        playersByUid.delete(disconnectedUid);
        mingleJoinedAt.delete(disconnectedUid);
        io.to(WORLD_ROOM).emit('player:left', {
          uid: disconnectedUid,
          displayName: rec.state.displayName,
        });
        broadcastMingleToAll();
      }
    });
  });

  // Authoritative 20 Hz World Snapshot + FULL-TIME AUTONOMOUS RUNNING KSRTC PUBLIC BUS LOOP
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.15, Math.max(0.016, (now - busLastTickMs) / 1000));
    busLastTickMs = now;

    // 1. Move Full-Time Public KSRTC Bus smoothly around Green Valley stops
    const nextIdx = (busStopIdx + 1) % PUBLIC_BUS_ROUTE_STOPS.length;
    const targetStop = PUBLIC_BUS_ROUTE_STOPS[nextIdx];
    if (now < busWaitUntilMs) {
      publicBus.isAtStop = true;
      publicBus.speed = 0;
    } else {
      publicBus.isAtStop = false;
      const dx = targetStop.x - publicBus.x;
      const dz = targetStop.z - publicBus.z;
      const dist = Math.hypot(dx, dz);
      const busSpeed = 14.5; // smooth realistic village bus cruising speed
      if (dist <= busSpeed * dt + 0.6) {
        publicBus.x = targetStop.x;
        publicBus.z = targetStop.z;
        publicBus.y = Math.max(0, groundHeightAt(publicBus.x, publicBus.z));
        publicBus.speed = 0;
        publicBus.isAtStop = true;
        busStopIdx = nextIdx;
        publicBus.currentStopName = PUBLIC_BUS_ROUTE_STOPS[busStopIdx].name;
        publicBus.nextStopName = PUBLIC_BUS_ROUTE_STOPS[(busStopIdx + 1) % PUBLIC_BUS_ROUTE_STOPS.length].name;
        busWaitUntilMs = now + 4000; // 4-second boarding pause at each stop
      } else {
        const vx = (dx / dist) * busSpeed;
        const vz = (dz / dist) * busSpeed;
        publicBus.x += vx * dt;
        publicBus.z += vz * dt;
        publicBus.y = Math.max(0, groundHeightAt(publicBus.x, publicBus.z));
        publicBus.rotY = Math.atan2(dx, dz);
        publicBus.speed = busSpeed;
      }
    }

    // 2. Accrue Live Time-Based Salary for Active Bus Conductor (paid every 30s + on shift end)
    if (publicBus.conductorUid && now - busLastSalaryTickMs >= 1000) {
      const elapsedSec = (now - busLastSalaryTickMs) / 1000;
      busLastSalaryTickMs = now;
      publicBus.conductorEarnedSalary += (CONDUCTOR_SALARY_PER_MIN / 60) * elapsedSec;
      const conductorRec = playersByUid.get(publicBus.conductorUid);
      if (conductorRec && publicBus.conductorEarnedSalary >= 36) {
        const pay = Math.floor(publicBus.conductorEarnedSalary);
        publicBus.conductorEarnedSalary -= pay;
        conductorRec.greenCoins = clamp(conductorRec.greenCoins + pay, 0, 10000000);
        conductorRec.xp = clamp(conductorRec.xp + 18, 0, 1000000);
        conductorRec.level = levelFromXp(conductorRec.xp);
        conductorRec.state.level = conductorRec.level;
        io.to(conductorRec.socketId).emit('economy:update', {
          greenCoins: conductorRec.greenCoins,
          xp: conductorRec.xp,
          level: conductorRec.level,
          tx: {
            type: 'earn',
            amount: pay,
            reason: 'KSRTC Conductor Time Salary',
            balanceAfter: conductorRec.greenCoins,
          },
          toast: {
            title: `Conductor Salary: +${pay} GC`,
            detail: 'Paid for your live time on KSRTC Public Express!',
            tone: 'amber',
          },
        });
      }
    }

    // 3. Keep Conductor & Boarded Passengers synced to the moving Bus coordinates
    if (publicBus.conductorUid) {
      const cRec = playersByUid.get(publicBus.conductorUid);
      if (cRec) {
        cRec.state.x = publicBus.x;
        cRec.state.y = publicBus.y + 0.8;
        cRec.state.z = publicBus.z;
        cRec.state.rotY = publicBus.rotY;
      }
    }
    for (const pInfo of publicBus.passengers) {
      const pRec = playersByUid.get(pInfo.uid);
      if (pRec) {
        pRec.state.x = publicBus.x;
        pRec.state.y = publicBus.y + 0.8;
        pRec.state.z = publicBus.z;
        pRec.state.rotY = publicBus.rotY;
      }
    }

    // 3b. Authoritative 3D Football & Volleyball Physics
    const fb = sportsBalls.football;
    fb.x += fb.vx * dt;
    fb.z += fb.vz * dt;
    fb.y += fb.vy * dt;
    if (fb.y > 0.42) {
      fb.vy -= 18 * dt;
    } else {
      fb.y = 0.42;
      fb.vy = Math.abs(fb.vy) > 1.2 ? -fb.vy * 0.45 : 0;
    }
    fb.vx *= 0.965;
    fb.vz *= 0.965;
    // Goal detection on North/South pitch ends
    const fbRelX = fb.x - FOOTBALL_PITCH_CENTER.x;
    const fbRelZ = fb.z - FOOTBALL_PITCH_CENTER.z;
    if (Math.abs(fbRelX) < 5.5 && Math.abs(fbRelZ) > 19.5) {
      if (fbRelZ > 0) fb.scoreA += 1;
      else fb.scoreB += 1;
      fb.x = FOOTBALL_PITCH_CENTER.x;
      fb.z = FOOTBALL_PITCH_CENTER.z;
      fb.y = 0.42;
      fb.vx = 0;
      fb.vy = 0;
      fb.vz = 0;
      io.to(WORLD_ROOM).emit('toast:info', {
        title: `GOAL!! Score ${fb.scoreA} – ${fb.scoreB}`,
        detail: 'Valley Sports Complex Football Pitch!',
      });
    } else if (Math.abs(fbRelX) > 16 || Math.abs(fbRelZ) > 22) {
      fb.vx *= -0.6;
      fb.vz *= -0.6;
      fb.x = FOOTBALL_PITCH_CENTER.x + clamp(fbRelX, -15.5, 15.5);
      fb.z = FOOTBALL_PITCH_CENTER.z + clamp(fbRelZ, -21.5, 21.5);
    }

    const vb = sportsBalls.volleyball;
    vb.x += vb.vx * dt;
    vb.z += vb.vz * dt;
    vb.y += vb.vy * dt;
    if (vb.y > 0.36) {
      vb.vy -= 15.5 * dt;
    } else {
      vb.y = 0.36;
      vb.vy = Math.abs(vb.vy) > 1.0 ? -vb.vy * 0.62 : 0;
    }
    vb.vx *= 0.975;
    vb.vz *= 0.975;
    const vbRelX = vb.x - VOLLEYBALL_COURT_CENTER.x;
    const vbRelZ = vb.z - VOLLEYBALL_COURT_CENTER.z;
    // Bounce off center net if too low
    if (Math.abs(vbRelZ) < 0.6 && vb.y < 2.3) {
      vb.vz *= -0.7;
      vb.z = VOLLEYBALL_COURT_CENTER.z + (vbRelZ >= 0 ? 0.7 : -0.7);
    }
    if (Math.abs(vbRelX) > 9.5 || Math.abs(vbRelZ) > 12.5) {
      vb.vx *= -0.65;
      vb.vz *= -0.65;
      vb.x = VOLLEYBALL_COURT_CENTER.x + clamp(vbRelX, -9.2, 9.2);
      vb.z = VOLLEYBALL_COURT_CENTER.z + clamp(vbRelZ, -12.2, 12.2);
    }

    if (playersByUid.size === 0) return;
    const players: NetworkPlayer[] = [];
    for (const rec of playersByUid.values()) {
      if (rec.state.chatBubbleUntil && now > rec.state.chatBubbleUntil) {
        rec.state.chatBubble = undefined;
        rec.state.chatBubbleUntil = undefined;
      }
      if (rec.state.emoteUntil && now > rec.state.emoteUntil && !rec.state.vehicleId) {
        rec.state.emoteUntil = undefined;
      }
      if (rec.state.heldItemUntil && now > rec.state.heldItemUntil) {
        rec.state.heldItem = 'none';
        rec.state.heldItemUntil = undefined;
      }
      players.push(rec.state);
    }
    io.to(WORLD_ROOM).emit('world:snapshot', {
      players,
      vehicles: Array.from(vehiclesById.values()),
      publicBus,
      sportsBalls: [fb, vb],
    });
  }, 50);

  // Automatic Max 5-Minute Single-to-Mingle Matchmaker & 60-Second Alarm Scheduler
  setInterval(() => {
    const now = Date.now();
    const remainingMs = mingleNextEventAtMs - now;

    // 60-Second Warning Alarm before the 5-minute round auto-selects
    if (remainingMs <= 60 * 1000 && remainingMs > 0 && mingleAlarmSentForRound !== mingleNextEventAtMs) {
      mingleAlarmSentForRound = mingleNextEventAtMs;
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      if (playersByUid.size > 0) {
        io.to(WORLD_ROOM).emit('mingle:alarm', {
          locationName: loc.name,
          locationPos: loc.pos,
          nextEventAtMs: mingleNextEventAtMs,
        });
      }
    }

    // When the 5-minute timer expires -> auto-select 2 joined accounts & reset timer to 5 min!
    if (remainingMs <= 0) {
      mingleNextEventAtMs = now + MINGLE_MAX_ROUND_MS;
      mingleAlarmSentForRound = 0;
      if (playersByUid.size === 0) return;

      const joinedRecords: ServerPlayerRecord[] = [];
      for (const joinedUid of mingleJoinedAt.keys()) {
        const r = playersByUid.get(joinedUid);
        if (r) joinedRecords.push(r);
      }
      if (joinedRecords.length === 0) {
        for (const p of playersByUid.values()) {
          io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
        }
        return;
      }

      const shuffled = [...joinedRecords].sort(() => Math.random() - 0.5);
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      const matchId = `mingle_5m_${now}`;

      let partA: MingleParticipant;
      let partB: MingleParticipant;
      if (shuffled.length >= 2) {
        const men = shuffled.filter((r) => r.state.appearance.gender === 'male');
        const women = shuffled.filter((r) => r.state.appearance.gender === 'female');
        if (men.length > 0 && women.length > 0) {
          partA = toMingleParticipant(men[0]);
          partB = toMingleParticipant(women[0]);
        } else {
          partA = toMingleParticipant(shuffled[0]);
          partB = toMingleParticipant(shuffled[1]);
        }
      } else {
        partA = toMingleParticipant(shuffled[0]);
        const wanted = partA.gender === 'male' ? 'female' : 'male';
        const pool = VALLEY_SINGLES.filter((n) => n.gender === wanted);
        const pick = pool[Math.floor(Math.random() * pool.length)] || VALLEY_SINGLES[0];
        partB = npcToMingleParticipant(pick);
      }

      const recA = !partA.isNpc ? playersByUid.get(partA.uid) : null;
      const recB = !partB.isNpc ? playersByUid.get(partB.uid) : null;
      if (recA) {
        recA.activeMingleMatch = {
          matchId,
          partnerUid: partB.uid,
          partnerName: partB.displayName,
          partnerInstagram: partB.instagramId,
          partnerPhotoURL: partB.photoURL,
          partnerAppearance: partB.appearance,
          partnerAge: partB.age,
          partnerGender: partB.gender,
          isNpcPartner: Boolean(partB.isNpc),
          myAccepted: false,
          partnerAccepted: Boolean(partB.isNpc),
          status: 'proposed',
        };
      }
      if (recB) {
        recB.activeMingleMatch = {
          matchId,
          partnerUid: partA.uid,
          partnerName: partA.displayName,
          partnerInstagram: partA.instagramId,
          partnerPhotoURL: partA.photoURL,
          partnerAppearance: partA.appearance,
          partnerAge: partA.age,
          partnerGender: partA.gender,
          isNpcPartner: Boolean(partA.isNpc),
          myAccepted: false,
          partnerAccepted: Boolean(partA.isNpc),
          status: 'proposed',
        };
      }
      currentSelectedPair = {
        matchId,
        memberA: partA,
        memberB: partB,
        selectedAt: now,
        locationName: loc.name,
        locationPos: loc.pos,
        status: 'proposed',
        memberAAccepted: Boolean(partA.isNpc),
        memberBAccepted: Boolean(partB.isNpc),
      };
      for (const p of playersByUid.values()) {
        io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
      }
      io.to(WORLD_ROOM).emit('toast:info', {
        title: '5-Min Auto-Select Complete (FREE)!',
        detail: `${partA.displayName} ♥ ${partB.displayName} revealed on the 3D Mingle Screen!`,
      });
    }
  }, 2000);

  // Mount Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TYPIXEL OPEN WORLD (Green Valley) server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

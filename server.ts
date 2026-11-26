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
  InteriorTheme,
  MingleEventState,
  MingleParticipant,
  MingleSelectedPair,
  NetworkPlayer,
  RelationshipStatus,
  VehicleState,
  WorldPropertyOwnership,
} from './src/shared/types.ts';
import { DEFAULT_APPEARANCE } from './src/shared/types.ts';
import {
  ACTIVE_BUILDINGS,
  BUSINESSES,
  CUSTOM_HOME_PLANS,
  CUSTOM_SHOP_PLANS,
  DAILY_LOGIN_REWARDS,
  INITIAL_VEHICLES,
  MINGLE_MEETUP_LOCATIONS,
  MISSIONS,
  PROPERTIES,
  REWARDS,
  SHOP_ITEMS,
  SHOWCASE_ADS,
  VALLEY_SINGLES,
  WORK_JOBS,
  WORLD_HALF_SIZE,
  WORLD_SPAWN,
  groundHeightAt,
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
}

const playersByUid = new Map<string, ServerPlayerRecord>();
const uidBySocketId = new Map<string, string>();
const vehiclesById = new Map<string, VehicleState>();
const worldProperties = new Map<string, WorldPropertyOwnership>();
const customHomesById = new Map<string, CustomHomeDef>();
const customShopsById = new Map<string, CustomShopDef>();

// In-memory cache for strictly allowlisted GitHub Showcase ad images
const adImageCache = new Map<string, { buf: Buffer; contentType: string }>();
const ALLOWED_AD_FILENAMES = new Set(SHOWCASE_ADS.map((a) => a.filename));

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateKey(): string {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNextHourTimestamp(): number {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next.getTime();
}

let currentMingleLocationIdx = 0;
let lastAlarmHourKey = '';
let lastMatchHourKey = '';
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
  const nextAt = getNextHourTimestamp();
  const remainingMs = nextAt - Date.now();
  const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
  return {
    nextEventAtMs: nextAt,
    alarmActive: remainingMs <= 5 * 60 * 1000 && remainingMs > 0,
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
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (!isVerifiedAdminEmail(decoded.email, decoded.email_verified)) return null;
      return { uid: decoded.uid, email: decoded.email || '' };
    } catch {
      return null;
    }
  };

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
      const isAdmin = isVerifiedAdminEmail(decoded.email, decoded.email_verified);

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

      const isAdmin = Boolean(socket.data.isAdmin);
      const netState: NetworkPlayer = {
        uid,
        displayName,
        instagramId,
        photoURL: verifiedPhoto,
        age,
        relationshipStatus,
        partnerName: partnerName || undefined,
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
        dailyRewardReadyAt: 0,
      };
      playersByUid.set(uid, record);
      // Auto-join player into the free Single-to-Mingle live accounts screen
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
        players: allPlayers,
        vehicles: Array.from(vehiclesById.values()),
        properties: Array.from(worldProperties.values()),
        customHomes: Array.from(customHomesById.values()),
        customShops: Array.from(customShopsById.values()),
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

      nextX = clamp(nextX, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
      nextZ = clamp(nextZ, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
      const minY = groundHeightAt(nextX, nextZ) - 0.5;
      const maxY = drivingVehicle?.canFly ? 76 : 26;
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
          const secs = Math.ceil((rec.dailyRewardReadyAt - now) / 1000);
          socket.emit('action:error', {
            message: `Next check-in reward ready in ${secs}s.`,
          });
          return;
        }
        rec.dailyRewardReadyAt = now + reward.repeatableSec * 1000;
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
    // CUSTOM 3D HOME BUILDER (Admin builds FREE; normal players spend Green Coins)
    // =========================================================================
    socket.on('home:build', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const style = String(payload?.style || 'cabin') as CustomHomeStyle;
      const plan = CUSTOM_HOME_PLANS.find((p) => p.style === style);
      if (!plan) return;

      const cost = rec.isAdmin ? 0 : plan.price;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${plan.price} GC to build ${plan.label} (you have ${rec.greenCoins} GC).`,
        });
        return;
      }

      const requestedX =
        typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : rec.state.x + 14;
      const requestedZ =
        typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : rec.state.z;
      const coords = findSafeHomeCoordinates(requestedX, requestedZ);

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
      const hasPool = plan.defaultPool || payload?.hasPool === true;

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
        interiorTheme,
        gardenStyle,
        x: coords.x,
        y: coords.y,
        z: coords.z,
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
                reason: `Built ${homeName}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: `Home Built: ${homeName}`,
          detail: rec.isAdmin
            ? `Admin Free Build at (${Math.round(coords.x)}, ${Math.round(coords.z)})!`
            : `Spawned at (${Math.round(coords.x)}, ${Math.round(coords.z)}) in Green Valley!`,
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
      const coords = findSafeHomeCoordinates(requestedX, requestedZ);

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
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        inventory: [...rec.inventory],
        healthRestore: item.healthRestore,
        toast: {
          title: `Used ${item.name}`,
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
    // DAILY LOGIN REWARD (7-Day Streak Tracked in Firestore Profile)
    // =========================================================================
    socket.on('daily:claim', () => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const today = getTodayDateKey();
      if (rec.lastDailyLoginDate === today) {
        socket.emit('action:error', {
          message: 'Today’s Daily Login Reward is already claimed! Come back tomorrow.',
        });
        return;
      }
      const yesterday = getYesterdayDateKey();
      const nextStreak =
        rec.lastDailyLoginDate === yesterday ? Math.min(365, rec.dailyLoginStreak + 1) : 1;
      const tier = DAILY_LOGIN_REWARDS[(nextStreak - 1) % DAILY_LOGIN_REWARDS.length];

      rec.lastDailyLoginDate = today;
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
        tx: {
          type: 'earn',
          amount: tier.coins,
          reason: `Daily Login Reward (Day ${nextStreak})`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Day ${nextStreak} Daily Bonus: +${tier.coins} GC!`,
          detail: `${tier.label} · +${tier.xp} XP`,
          tone: 'amber',
        },
      });
    });

    // =========================================================================
    // PLAYER-CREATED SHOPS (Tea Stall / Chaya Kada, Juice Bar, Bakery, Boutique, Tech)
    // =========================================================================
    socket.on('shop:open', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const shopType = String(payload?.shopType || 'tea_stall') as CustomShopType;
      const plan = CUSTOM_SHOP_PLANS.find((p) => p.shopType === shopType);
      if (!plan) return;

      const cost = rec.isAdmin ? 0 : plan.price;
      if (cost > 0 && rec.greenCoins < cost) {
        socket.emit('action:error', {
          message: `Need ${plan.price} GC to open ${plan.label} (you have ${rec.greenCoins} GC).`,
        });
        return;
      }

      const rawX = typeof payload?.x === 'number' && Number.isFinite(payload.x) ? payload.x : rec.state.x + 6;
      const rawZ = typeof payload?.z === 'number' && Number.isFinite(payload.z) ? payload.z : rec.state.z + 6;
      const sx = clamp(rawX, -WORLD_HALF_SIZE + 25, WORLD_HALF_SIZE - 25);
      const sz = clamp(rawZ, -WORLD_HALF_SIZE + 25, WORLD_HALF_SIZE - 25);
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
        ownerUid: uid,
        ownerName: rec.state.displayName,
        ownerInstagram: rec.state.instagramId,
        awningColor,
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
                reason: `Opened ${shopName}`,
                balanceAfter: rec.greenCoins,
              },
            }
          : {}),
        toast: {
          title: `Shop Opened: ${shopName}!`,
          detail: `Your ${plan.label} is live in Green Valley!`,
          tone: 'emerald',
        },
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

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        updatedShop: shop,
        healthRestore: item.healthRestore,
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
          title: `Enjoyed ${item.name}!`,
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
    // ACTIVE BUILDING INTERIOR SERVICES (Hospital, Mall, Bank, School, KSRTC Depot, etc.)
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

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
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
          title: svc.label,
          detail:
            gain > 0
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
    // FREE SINGLE-TO-MINGLE: Live Joined Accounts, Auto-Select 2 Accounts, DP Reveal, Free Marriage & Free Honeymoon
    // =========================================================================
    const broadcastMingleToAll = () => {
      for (const p of playersByUid.values()) {
        io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
      }
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

      // Shuffle joined accounts for fair random selection from screen
      const shuffled = [...joinedRecords].sort(() => Math.random() - 0.5);
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      const matchId = `mingle_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      let recA: ServerPlayerRecord | null = null;
      let recB: ServerPlayerRecord | null = null;

      if (shuffled.length >= 2) {
        // Prefer 1 male + 1 female real account from joined screen; otherwise pick any 2 real joined accounts
        const men = shuffled.filter((r) => r.state.appearance.gender === 'male');
        const women = shuffled.filter((r) => r.state.appearance.gender === 'female');
        if (men.length > 0 && women.length > 0) {
          recA = men[0];
          recB = women[0];
        } else {
          recA = shuffled[0];
          recB = shuffled[1];
        }
      } else {
        recA = shuffled[0];
      }

      if (recA && recB) {
        const partA = toMingleParticipant(recA);
        const partB = toMingleParticipant(recB);

        recA.activeMingleMatch = {
          matchId,
          partnerUid: partB.uid,
          partnerName: partB.displayName,
          partnerInstagram: partB.instagramId,
          partnerPhotoURL: partB.photoURL,
          partnerAppearance: partB.appearance,
          partnerAge: partB.age,
          partnerGender: partB.gender,
          isNpcPartner: false,
          myAccepted: false,
          partnerAccepted: false,
          status: 'proposed',
        };
        recB.activeMingleMatch = {
          matchId,
          partnerUid: partA.uid,
          partnerName: partA.displayName,
          partnerInstagram: partA.instagramId,
          partnerPhotoURL: partA.photoURL,
          partnerAppearance: partA.appearance,
          partnerAge: partA.age,
          partnerGender: partA.gender,
          isNpcPartner: false,
          myAccepted: false,
          partnerAccepted: false,
          status: 'proposed',
        };

        currentSelectedPair = {
          matchId,
          memberA: partA,
          memberB: partB,
          selectedAt: Date.now(),
          locationName: loc.name,
          locationPos: loc.pos,
          status: 'proposed',
          memberAAccepted: false,
          memberBAccepted: false,
        };

        broadcastMingleToAll();

        io.to(WORLD_ROOM).emit('toast:info', {
          title: '2 Accounts Auto-Selected (FREE)!',
          detail: `${partA.displayName} ♥ ${partB.displayName} selected at ${loc.name}!`,
        });
        io.to(WORLD_ROOM).emit('chat:message', {
          id: `sys_mingle_${Date.now()}`,
          uid: 'system',
          displayName: 'Single-to-Mingle Spotlight',
          photoURL: '',
          channel: 'system',
          text: `💘 Auto-Selected Couple: ${partA.displayName} & ${partB.displayName}! Open Single-to-Mingle to view their DPs (100% Free).`,
          timestamp: Date.now(),
        });
      } else if (recA) {
        // Solo fallback when only 1 real account is online right now
        const wantedGender = recA.state.appearance.gender === 'male' ? 'female' : 'male';
        const pool = VALLEY_SINGLES.filter((n) => n.gender === wantedGender);
        const pick = pool[Math.floor(Math.random() * pool.length)] || VALLEY_SINGLES[0];
        const partA = toMingleParticipant(recA);
        const partB = npcToMingleParticipant(pick);

        recA.activeMingleMatch = {
          matchId,
          partnerUid: partB.uid,
          partnerName: partB.displayName,
          partnerInstagram: partB.instagramId,
          partnerPhotoURL: partB.photoURL,
          partnerAppearance: partB.appearance,
          partnerAge: partB.age,
          partnerGender: partB.gender,
          isNpcPartner: true,
          myAccepted: false,
          partnerAccepted: true,
          status: 'proposed',
        };

        currentSelectedPair = {
          matchId,
          memberA: partA,
          memberB: partB,
          selectedAt: Date.now(),
          locationName: loc.name,
          locationPos: loc.pos,
          status: 'proposed',
          memberAAccepted: false,
          memberBAccepted: true,
        };

        broadcastMingleToAll();

        io.to(recA.socketId).emit('toast:info', {
          title: 'Free Single-to-Mingle Match Selected!',
          detail: `${partA.displayName} ♥ ${partB.displayName} at ${loc.name} (100% Free)!`,
        });
      }
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
        detail: 'Your account & DP are now live on the Single-to-Mingle screen.',
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

    socket.on('mingle:triggerDemo', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const mode = payload?.mode === 'alarm' ? 'alarm' : 'match';
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      if (mode === 'alarm') {
        io.to(WORLD_ROOM).emit('mingle:alarm', {
          locationName: loc.name,
          locationPos: loc.pos,
          nextEventAtMs: Date.now() + 5 * 60 * 1000,
        });
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

      if (!accept) {
        rec.activeMingleMatch = null;
        if (partnerRec && partnerRec.activeMingleMatch?.matchId === match.matchId) {
          partnerRec.activeMingleMatch = null;
          io.to(partnerRec.socketId).emit('toast:info', {
            title: 'Match Ended',
            detail: `${rec.state.displayName} declined this round.`,
          });
        }
        if (currentSelectedPair?.matchId === match.matchId) {
          currentSelectedPair = null;
        }
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

      // Celebrate FREE Grand Marriage Ceremony at Royal Wedding Mandapam (No Money Needed!)
      if (currentSelectedPair?.matchId === match.matchId) {
        currentSelectedPair.status = 'married';
        currentSelectedPair.memberAAccepted = true;
        currentSelectedPair.memberBAccepted = true;
      }

      const finalizeMarriage = (p: ServerPlayerRecord, pPartnerName: string, pPartnerUid: string, pPartnerIg: string) => {
        if (p.activeMingleMatch) {
          p.activeMingleMatch.status = 'married';
          p.activeMingleMatch.myAccepted = true;
          p.activeMingleMatch.partnerAccepted = true;
        }
        p.relationshipStatus = 'married';
        p.partnerName = pPartnerName;
        p.state.relationshipStatus = 'married';
        p.state.partnerName = pPartnerName;
        p.xp = clamp(p.xp + 200, 0, 1000000);
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
          teleportTo: { x: -110, y: 0, z: -14 },
          toast: {
            title: `Just Married: ${p.state.displayName} ♥ ${pPartnerName}!`,
            detail: '100% FREE Royal Wedding & Honeymoon Unlocked!',
            tone: 'rose',
          },
        });
      };

      finalizeMarriage(rec, match.partnerName, match.partnerUid, match.partnerInstagram);
      if (partnerRec) {
        finalizeMarriage(partnerRec, rec.state.displayName, rec.state.uid, rec.state.instagramId);
      }

      broadcastMingleToAll();

      io.to(WORLD_ROOM).emit('chat:message', {
        id: `sys_wed_${Date.now()}`,
        uid: 'system',
        displayName: 'Green Valley Wedding Bell',
        photoURL: '',
        channel: 'system',
        text: `🎉 Free Grand Marriage Celebration! ${rec.state.displayName} ♥ ${match.partnerName} just got married at the Royal Wedding Mandapam!`,
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
      rec.xp = clamp(rec.xp + 120, 0, 1000000);
      rec.level = levelFromXp(rec.xp);
      rec.state.level = rec.level;
      broadcastMingleToAll();
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        healthRestore: 100,
        toast: {
          title: 'Free Royal Wedding Feast Served!',
          detail: 'Complimentary Kerala Sadhya, Biryani, Payasam & Cake (+100 HP · +120 XP)',
          tone: 'amber',
        },
      });
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

  // Authoritative 20 Hz world snapshot broadcast
  setInterval(() => {
    if (playersByUid.size === 0) return;
    const now = Date.now();
    const players: NetworkPlayer[] = [];
    for (const rec of playersByUid.values()) {
      if (rec.state.chatBubbleUntil && now > rec.state.chatBubbleUntil) {
        rec.state.chatBubble = undefined;
        rec.state.chatBubbleUntil = undefined;
      }
      if (rec.state.emoteUntil && now > rec.state.emoteUntil && !rec.state.vehicleId) {
        rec.state.emoteUntil = undefined;
      }
      players.push(rec.state);
    }
    io.to(WORLD_ROOM).emit('world:snapshot', {
      players,
      vehicles: Array.from(vehiclesById.values()),
    });
  }, 50);

  // Automatic Hourly Single-to-Mingle Matchmaker & 5-Minute Alarm Scheduler
  setInterval(() => {
    if (playersByUid.size === 0) return;
    const now = new Date();
    const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const mins = now.getMinutes();

    // 5-Minute Alarm before every hour (:55 to :59)
    if (mins === 55 && lastAlarmHourKey !== hourKey) {
      lastAlarmHourKey = hourKey;
      currentMingleLocationIdx = (currentMingleLocationIdx + 1) % MINGLE_MEETUP_LOCATIONS.length;
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx];
      const nextAt = getNextHourTimestamp();
      for (const rec of playersByUid.values()) {
        if (rec.relationshipStatus === 'single') {
          io.to(rec.socketId).emit('mingle:alarm', {
            locationName: loc.name,
            locationPos: loc.pos,
            nextEventAtMs: nextAt,
          });
        }
      }
    }

    // Top-of-the-hour Automatic Single-to-Mingle Matchmaking (:00) — Auto-selects 2 real joined accounts for FREE!
    if (mins === 0 && lastMatchHourKey !== hourKey) {
      lastMatchHourKey = hourKey;
      const joinedRecords: ServerPlayerRecord[] = [];
      for (const joinedUid of mingleJoinedAt.keys()) {
        const r = playersByUid.get(joinedUid);
        if (r) joinedRecords.push(r);
      }
      if (joinedRecords.length === 0) return;

      const shuffled = [...joinedRecords].sort(() => Math.random() - 0.5);
      const loc = MINGLE_MEETUP_LOCATIONS[currentMingleLocationIdx % MINGLE_MEETUP_LOCATIONS.length];
      const matchId = `mingle_hr_${Date.now()}`;

      let recA: ServerPlayerRecord | null = null;
      let recB: ServerPlayerRecord | null = null;
      if (shuffled.length >= 2) {
        const men = shuffled.filter((r) => r.state.appearance.gender === 'male');
        const women = shuffled.filter((r) => r.state.appearance.gender === 'female');
        if (men.length > 0 && women.length > 0) {
          recA = men[0];
          recB = women[0];
        } else {
          recA = shuffled[0];
          recB = shuffled[1];
        }
      } else {
        recA = shuffled[0];
      }

      if (recA && recB) {
        const partA = toMingleParticipant(recA);
        const partB = toMingleParticipant(recB);
        recA.activeMingleMatch = {
          matchId,
          partnerUid: partB.uid,
          partnerName: partB.displayName,
          partnerInstagram: partB.instagramId,
          partnerPhotoURL: partB.photoURL,
          partnerAppearance: partB.appearance,
          partnerAge: partB.age,
          partnerGender: partB.gender,
          isNpcPartner: false,
          myAccepted: false,
          partnerAccepted: false,
          status: 'proposed',
        };
        recB.activeMingleMatch = {
          matchId,
          partnerUid: partA.uid,
          partnerName: partA.displayName,
          partnerInstagram: partA.instagramId,
          partnerPhotoURL: partA.photoURL,
          partnerAppearance: partA.appearance,
          partnerAge: partA.age,
          partnerGender: partA.gender,
          isNpcPartner: false,
          myAccepted: false,
          partnerAccepted: false,
          status: 'proposed',
        };
        currentSelectedPair = {
          matchId,
          memberA: partA,
          memberB: partB,
          selectedAt: Date.now(),
          locationName: loc.name,
          locationPos: loc.pos,
          status: 'proposed',
          memberAAccepted: false,
          memberBAccepted: false,
        };
        for (const p of playersByUid.values()) {
          io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
        }
        io.to(WORLD_ROOM).emit('toast:info', {
          title: 'Hourly Auto-Select (FREE)!',
          detail: `${partA.displayName} ♥ ${partB.displayName} selected at ${loc.name}!`,
        });
      } else if (recA) {
        const wanted = recA.state.appearance.gender === 'male' ? 'female' : 'male';
        const pool = VALLEY_SINGLES.filter((n) => n.gender === wanted);
        const pick = pool[Math.floor(Math.random() * pool.length)] || VALLEY_SINGLES[0];
        const partA = toMingleParticipant(recA);
        const partB = npcToMingleParticipant(pick);
        recA.activeMingleMatch = {
          matchId,
          partnerUid: partB.uid,
          partnerName: partB.displayName,
          partnerInstagram: partB.instagramId,
          partnerPhotoURL: partB.photoURL,
          partnerAppearance: partB.appearance,
          partnerAge: partB.age,
          partnerGender: partB.gender,
          isNpcPartner: true,
          myAccepted: false,
          partnerAccepted: true,
          status: 'proposed',
        };
        currentSelectedPair = {
          matchId,
          memberA: partA,
          memberB: partB,
          selectedAt: Date.now(),
          locationName: loc.name,
          locationPos: loc.pos,
          status: 'proposed',
          memberAAccepted: false,
          memberBAccepted: true,
        };
        for (const p of playersByUid.values()) {
          io.to(p.socketId).emit('mingle:update', buildMingleStateForPlayer(p));
        }
        io.to(recA.socketId).emit('toast:info', {
          title: 'Hourly Free Single-to-Mingle Match!',
          detail: `${partA.displayName} ♥ ${partB.displayName} at ${loc.name}!`,
        });
      }
    }
  }, 5000);

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

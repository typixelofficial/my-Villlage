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
  EmoteType,
  GardenStyle,
  InteriorTheme,
  NetworkPlayer,
  VehicleState,
  WorldPropertyOwnership,
} from './src/shared/types.ts';
import { DEFAULT_APPEARANCE } from './src/shared/types.ts';
import {
  BUSINESSES,
  CUSTOM_HOME_PLANS,
  INITIAL_VEHICLES,
  MISSIONS,
  PROPERTIES,
  REWARDS,
  SHOP_ITEMS,
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

// ============================================================================
// Server-Side Admin Passcode Auth (scrypt + timingSafeEqual + in-memory Bearer)
// ============================================================================
interface ClaimedAdminPasscode {
  saltHex: string;
  hashHex: string;
}

const ENV_ADMIN_PASSCODE = (process.env.ADMIN_PASSCODE || '').trim();
let claimedAdminPasscode: ClaimedAdminPasscode | null = null;
const adminSessions = new Map<string, { createdAt: number; expiresAt: number }>();
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function hashPasscode(passcode: string, saltHex: string): Buffer {
  return crypto.scryptSync(passcode, saltHex, 64);
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyAdminPasscode(input: string): boolean {
  const candidate = input.trim();
  if (candidate.length < 4 || candidate.length > 128) return false;
  if (ENV_ADMIN_PASSCODE.length > 0) {
    return timingSafeMatch(candidate, ENV_ADMIN_PASSCODE);
  }
  if (!claimedAdminPasscode) return false;
  const derived = hashPasscode(candidate, claimedAdminPasscode.saltHex);
  const stored = Buffer.from(claimedAdminPasscode.hashHex, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function issueAdminSessionToken(): string {
  const now = Date.now();
  // Prune expired sessions
  for (const [tok, meta] of adminSessions.entries()) {
    if (meta.expiresAt <= now) adminSessions.delete(tok);
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { createdAt: now, expiresAt: now + ADMIN_SESSION_TTL_MS });
  return token;
}

function isValidAdminToken(token: unknown): boolean {
  if (typeof token !== 'string' || token.length < 32) return false;
  const meta = adminSessions.get(token);
  if (!meta) return false;
  if (meta.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

interface ServerPlayerRecord {
  socketId: string;
  state: NetworkPlayer;
  isAdmin: boolean;
  lastMoveAt: number;
  lastChatAt: number;
  lastActionAt: number;
  greenCoins: number;
  xp: number;
  level: number;
  ownedProperties: Set<string>;
  ownedBusinesses: Set<string>;
  ownedVehicles: Set<string>;
  completedMissions: Set<string>;
  claimedRewards: Set<string>;
  inventory: string[];
  friends: Set<string>;
  businessCooldowns: Map<string, number>;
  workCooldowns: Map<string, number>;
  dailyRewardReadyAt: number;
}

const playersByUid = new Map<string, ServerPlayerRecord>();
const uidBySocketId = new Map<string, string>();
const vehiclesById = new Map<string, VehicleState>();
const worldProperties = new Map<string, WorldPropertyOwnership>();
const customHomesById = new Map<string, CustomHomeDef>();

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
const VALID_HAIRS = new Set(['short', 'long', 'spiky', 'bob', 'ponytail']);
const VALID_SHIRTS = new Set(['tee', 'jacket', 'hoodie', 'polo']);
const VALID_ACCESSORIES = new Set(['none', 'glasses', 'cap', 'backpack', 'headphones']);
const VALID_HOME_STYLES = new Set<CustomHomeStyle>(['cabin', 'modern', 'villa', 'manor']);
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
    res.json({
      status: 'ok',
      world: 'GREEN VALLEY',
      room: WORLD_ROOM,
      onlinePlayers: playersByUid.size,
      vehiclesCount: vehiclesById.size,
      customHomesCount: customHomesById.size,
      worldSizeMeters: WORLD_HALF_SIZE * 2,
    });
  });

  // Admin Passcode Status / First-Run Claim / Login APIs (never leaks secrets)
  app.get('/api/admin/status', (_req, res) => {
    res.json({
      envConfigured: ENV_ADMIN_PASSCODE.length > 0,
      claimed: ENV_ADMIN_PASSCODE.length > 0 || claimedAdminPasscode !== null,
      bootstrappedEmail: BOOTSTRAPPED_ADMIN_EMAIL,
    });
  });

  app.post('/api/admin/claim', (req, res) => {
    if (ENV_ADMIN_PASSCODE.length > 0) {
      res.status(409).json({
        error: 'Admin passcode is configured via server environment. Sign in directly.',
      });
      return;
    }
    if (claimedAdminPasscode !== null) {
      res.status(409).json({
        error: 'Admin passcode has already been claimed on this server.',
      });
      return;
    }
    const rawPasscode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (rawPasscode.length < 6 || rawPasscode.length > 128) {
      res.status(400).json({ error: 'Choose an admin passcode between 6 and 128 characters.' });
      return;
    }
    const saltHex = crypto.randomBytes(16).toString('hex');
    const hashHex = hashPasscode(rawPasscode, saltHex).toString('hex');
    claimedAdminPasscode = { saltHex, hashHex };
    const adminToken = issueAdminSessionToken();
    res.json({ ok: true, adminToken, expiresInMs: ADMIN_SESSION_TTL_MS });
  });

  app.post('/api/admin/login', (req, res) => {
    const rawPasscode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!verifyAdminPasscode(rawPasscode)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }
    const adminToken = issueAdminSessionToken();
    res.json({ ok: true, adminToken, expiresInMs: ADMIN_SESSION_TTL_MS });
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
      const isBootstrappedAdmin =
        decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
      const isPasscodeAdmin = isValidAdminToken(adminToken);

      socket.data.uid = decoded.uid;
      socket.data.email = decoded.email || '';
      socket.data.emailVerified = Boolean(decoded.email_verified);
      socket.data.googleName = decoded.name || 'Valley Explorer';
      socket.data.photoURL = decoded.picture || '';
      socket.data.isAdmin = isBootstrappedAdmin || isPasscodeAdmin;
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

    // Elevate an already-connected player to Admin via verified Bearer adminToken
    socket.on('admin:authenticate', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const candidateToken = payload?.adminToken;
      if (isValidAdminToken(candidateToken)) {
        rec.isAdmin = true;
        rec.state.isAdmin = true;
        socket.data.isAdmin = true;
        socket.emit('admin:status', { isAdmin: true });
        io.to(WORLD_ROOM).emit('player:appearance', {
          uid,
          displayName: rec.state.displayName,
          instagramId: rec.state.instagramId,
          appearance: rec.state.appearance,
          isAdmin: true,
        });
      } else {
        socket.emit('action:error', { message: 'Admin session expired or invalid.' });
      }
    });

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

      const isAdmin = Boolean(socket.data.isAdmin);
      const netState: NetworkPlayer = {
        uid,
        displayName,
        instagramId,
        photoURL: verifiedPhoto,
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
      };

      const record: ServerPlayerRecord = {
        socketId: socket.id,
        state: netState,
        isAdmin,
        lastMoveAt: Date.now(),
        lastChatAt: 0,
        lastActionAt: 0,
        greenCoins: initCoins,
        xp: initXp,
        level: levelFromXp(initXp),
        ownedProperties: new Set(initProps),
        ownedBusinesses: new Set(initBiz),
        ownedVehicles: new Set(initVehicles),
        completedMissions: new Set(initMissions),
        claimedRewards: new Set(initRewards),
        inventory: initInventory,
        friends: new Set(initFriends),
        businessCooldowns: new Map(),
        workCooldowns: new Map(),
        dailyRewardReadyAt: 0,
      };
      playersByUid.set(uid, record);

      const allPlayers: NetworkPlayer[] = [];
      for (const rec of playersByUid.values()) {
        allPlayers.push(rec.state);
      }

      socket.emit('world:init', {
        selfUid: uid,
        room: WORLD_ROOM,
        isAdmin,
        players: allPlayers,
        vehicles: Array.from(vehiclesById.values()),
        properties: Array.from(worldProperties.values()),
        customHomes: Array.from(customHomesById.values()),
      });

      socket.to(WORLD_ROOM).emit('player:joined', netState);
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

    // Appearance & Instagram ID broadcast
    socket.on('player:appearance', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      rec.state.displayName = sanitizeName(payload?.displayName || rec.state.displayName);
      if (typeof payload?.instagramId === 'string') {
        rec.state.instagramId = sanitizeInstagram(payload.instagramId);
      }
      rec.state.appearance = sanitizeAppearance(payload?.appearance);
      io.to(WORLD_ROOM).emit('player:appearance', {
        uid,
        displayName: rec.state.displayName,
        instagramId: rec.state.instagramId,
        appearance: rec.state.appearance,
        isAdmin: rec.isAdmin,
      });
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

    // Global & Proximity Chat (rate limited)
    socket.on('chat:send', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const now = Date.now();
      if (now - rec.lastChatAt < 450) return;
      rec.lastChatAt = now;

      const text = sanitizeText(payload?.text, 180);
      if (!text) return;
      const channel = payload?.channel === 'proximity' ? 'proximity' : 'global';

      const msg: ChatMessage = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
        uid,
        displayName: rec.state.displayName,
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
    // WALK-UP ONLY VEHICLES: Must be physically near vehicle + Free/Rent/Buy
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

      // Strict physical proximity check — players MUST walk up to the vehicle!
      const dist = Math.hypot(rec.state.x - veh.x, rec.state.z - veh.z);
      if (dist > 14) {
        socket.emit('action:error', {
          message: 'Walk physically up to this vehicle first to take or rent it.',
        });
        return;
      }

      const isAlreadyOwned = rec.ownedVehicles.has(veh.id);
      const isFreeVehicle = veh.rentPrice <= 0 && veh.buyPrice <= 0;

      if (!isFreeVehicle && !isAlreadyOwned) {
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
    // CUSTOM 3D HOME BUILDER (Player builds with Green Coins)
    // =========================================================================
    socket.on('home:build', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const style = String(payload?.style || 'cabin') as CustomHomeStyle;
      const plan = CUSTOM_HOME_PLANS.find((p) => p.style === style);
      if (!plan) return;

      if (rec.greenCoins < plan.price) {
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
        createdByAdmin: false,
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

      rec.greenCoins -= plan.price;
      rec.ownedProperties.add(homeId);
      customHomesById.set(homeId, customHome);

      io.to(WORLD_ROOM).emit('customHome:created', customHome);
      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ownedProperties: Array.from(rec.ownedProperties),
        createdHome: customHome,
        tx: {
          type: 'spend',
          amount: plan.price,
          reason: `Built ${homeName}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Home Built: ${homeName}`,
          detail: `Spawned at (${Math.round(coords.x)}, ${Math.round(coords.z)}) in Green Valley!`,
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

    // Server-validated Property Purchase
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
      if (rec.greenCoins < propDef.price) {
        socket.emit('action:error', {
          message: `Need ${propDef.price} Green Coins (you have ${rec.greenCoins}).`,
        });
        return;
      }

      rec.greenCoins -= propDef.price;
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
        tx: {
          type: 'spend',
          amount: propDef.price,
          reason: `Purchased ${propDef.name}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Property Purchased: ${propDef.name}`,
          detail: 'Welcome home! Customize interior & garden anytime.',
          tone: 'emerald',
        },
      });
    });

    // Property Customization Broadcast
    socket.on('property:customize', (payload: Record<string, unknown>) => {
      const rec = playersByUid.get(uid);
      if (!rec) return;
      const propertyId = typeof payload?.propertyId === 'string' ? payload.propertyId : '';
      const ownership = worldProperties.get(propertyId);
      if (!ownership || ownership.ownerUid !== uid) return;

      const interiorTheme = VALID_INTERIORS.has(String(payload?.interiorTheme) as InteriorTheme)
        ? (payload.interiorTheme as InteriorTheme)
        : ownership.interiorTheme;
      const gardenStyle = VALID_GARDENS.has(String(payload?.gardenStyle) as GardenStyle)
        ? (payload.gardenStyle as GardenStyle)
        : ownership.gardenStyle;

      ownership.interiorTheme = interiorTheme;
      ownership.gardenStyle = gardenStyle;
      ownership.ownerName = rec.state.displayName;
      io.to(WORLD_ROOM).emit('property:updated', ownership);
    });

    // Server-validated Business Purchase
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
      if (rec.greenCoins < biz.price) {
        socket.emit('action:error', {
          message: `Need ${biz.price} Green Coins to acquire ${biz.name}.`,
        });
        return;
      }

      rec.greenCoins -= biz.price;
      rec.ownedBusinesses.add(businessId);
      const readyAt = Date.now() + biz.cooldownSec * 1000;
      rec.businessCooldowns.set(businessId, readyAt);

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        ownedBusinesses: Array.from(rec.ownedBusinesses),
        businessCooldown: { businessId, readyAt },
        tx: {
          type: 'spend',
          amount: biz.price,
          reason: `Acquired ${biz.name}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Business Acquired: ${biz.name}`,
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

    // Server-validated Shop Item Purchase
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
      if (rec.greenCoins < item.price) {
        socket.emit('action:error', { message: `Need ${item.price} Green Coins.` });
        return;
      }

      rec.greenCoins -= item.price;
      rec.inventory.push(item.id);

      socket.emit('economy:update', {
        greenCoins: rec.greenCoins,
        xp: rec.xp,
        level: rec.level,
        inventory: [...rec.inventory],
        tx: {
          type: 'spend',
          amount: item.price,
          reason: `Bought ${item.name}`,
          balanceAfter: rec.greenCoins,
        },
        toast: {
          title: `Purchased ${item.name}`,
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

    socket.on('disconnect', () => {
      const disconnectedUid = uidBySocketId.get(socket.id);
      uidBySocketId.delete(socket.id);
      if (!disconnectedUid) return;

      const rec = playersByUid.get(disconnectedUid);
      if (rec && rec.socketId === socket.id) {
        if (rec.state.vehicleId) {
          const veh = vehiclesById.get(rec.state.vehicleId);
          if (veh && veh.driverUid === disconnectedUid) {
            veh.driverUid = null;
            veh.speed = 0;
            io.to(WORLD_ROOM).emit('vehicle:updated', veh);
          }
        }
        playersByUid.delete(disconnectedUid);
        io.to(WORLD_ROOM).emit('player:left', {
          uid: disconnectedUid,
          displayName: rec.state.displayName,
        });
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

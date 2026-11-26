import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  CharacterAppearance,
  CustomHomeDef,
  CustomHomeStyle,
  CustomLocationPin,
  CustomShopDef,
  CustomShopType,
  GardenStyle,
  InteriorTheme,
  PlayerProfile,
  RelationshipStatus,
  WalletTransaction,
  WorldPropertyOwnership,
} from '../shared/types.ts';
import { DEFAULT_APPEARANCE } from '../shared/types.ts';
import { WORLD_SPAWN } from '../shared/worldData.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getYesterdayDateKey(): string {
  const d = new Date(Date.now() - 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 _\-]/g, '')
    .trim()
    .slice(0, 24);
  return cleaned.length >= 2 ? cleaned : 'Valley Explorer';
}

export function sanitizeInstagramId(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30);
}

export function findMatchingHomeForPlayer(
  profile: PlayerProfile,
  customHomes: Record<string, CustomHomeDef>,
): CustomHomeDef | null {
  const homes = Object.values(customHomes);
  const byUid = homes.find((h) => h.ownerUid === profile.uid);
  if (byUid) return byUid;
  const ig = sanitizeInstagramId(profile.instagramId).toLowerCase();
  if (!ig) return null;
  const byIg = homes.find(
    (h) => sanitizeInstagramId(h.ownerInstagram).toLowerCase() === ig,
  );
  return byIg || null;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const safeName = sanitizeDisplayName(displayName);
  try {
    await updateProfile(result.user, { displayName: safeName });
    void sendEmailVerification(result.user).catch(() => {});
  } catch {
    // Non-blocking profile/verification update
  }
  return result.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutPlayer(): Promise<void> {
  await signOut(auth);
}

function sanitizeLocations(raw: unknown): CustomLocationPin[] {
  if (!Array.isArray(raw)) return [];
  const validCats = new Set(['favorite', 'home', 'hangout', 'tea', 'event']);
  return raw
    .slice(0, 15)
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: String(item.id || `loc_${Math.random().toString(36).slice(2, 8)}`).slice(0, 64),
      name: String(item.name || 'Pin').trim().slice(0, 32) || 'Pin',
      category: (validCats.has(String(item.category))
        ? String(item.category)
        : 'favorite') as CustomLocationPin['category'],
      x: Math.max(-450, Math.min(450, Number(item.x) || 0)),
      z: Math.max(-450, Math.min(450, Number(item.z) || 0)),
    }));
}

export async function loadPlayerProfile(uid: string): Promise<PlayerProfile | null> {
  const path = `players/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'players', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    const rel: RelationshipStatus =
      d.relationshipStatus === 'mingle' || d.relationshipStatus === 'married'
        ? d.relationshipStatus
        : 'single';
    return {
      uid: String(d.uid || uid),
      displayName: sanitizeDisplayName(String(d.displayName || 'Valley Explorer')),
      instagramId: sanitizeInstagramId(String(d.instagramId || '')),
      photoURL: String(d.photoURL || ''),
      age: typeof d.age === 'number' && d.age >= 18 && d.age <= 90 ? Math.round(d.age) : 22,
      relationshipStatus: rel,
      partnerUid: String(d.partnerUid || ''),
      partnerName: String(d.partnerName || ''),
      partnerInstagram: sanitizeInstagramId(String(d.partnerInstagram || '')),
      lastDailyLoginDate: typeof d.lastDailyLoginDate === 'string' ? d.lastDailyLoginDate : '',
      dailyLoginStreak: typeof d.dailyLoginStreak === 'number' ? d.dailyLoginStreak : 0,
      totalDailyLogins: typeof d.totalDailyLogins === 'number' ? d.totalDailyLogins : 0,
      followedOfficial: Boolean(d.followedOfficial ?? true),
      followedStudio: Boolean(d.followedStudio ?? true),
      customLocations: sanitizeLocations(d.customLocations),
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...(d.appearance || {}),
      },
      greenCoins: typeof d.greenCoins === 'number' ? d.greenCoins : 1500,
      level: typeof d.level === 'number' ? d.level : 1,
      xp: typeof d.xp === 'number' ? d.xp : 0,
      ownedProperties: Array.isArray(d.ownedProperties) ? d.ownedProperties : [],
      ownedBusinesses: Array.isArray(d.ownedBusinesses) ? d.ownedBusinesses : [],
      ownedVehicles: Array.isArray(d.ownedVehicles) ? d.ownedVehicles : [],
      completedMissions: Array.isArray(d.completedMissions) ? d.completedMissions : [],
      claimedRewards: Array.isArray(d.claimedRewards) ? d.claimedRewards : [],
      inventory: Array.isArray(d.inventory) ? d.inventory : [],
      friends: Array.isArray(d.friends) ? d.friends : [],
      lastPosition:
        d.lastPosition && typeof d.lastPosition.x === 'number'
          ? {
              x: d.lastPosition.x,
              y: d.lastPosition.y ?? 0,
              z: d.lastPosition.z,
            }
          : { ...WORLD_SPAWN },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

const VALID_HAIR_STYLES = new Set([
  'short',
  'long',
  'spiky',
  'bob',
  'ponytail',
  'braids',
  'fade',
  'curly',
]);
const VALID_SHIRT_STYLES = new Set([
  'tee',
  'jacket',
  'hoodie',
  'polo',
  'shirt',
  'mundu',
  'dress',
  'kurti',
  'lehenga',
]);
const VALID_ACCESSORIES = new Set(['none', 'glasses', 'cap', 'backpack', 'headphones']);

function sanitizeHexColor(val: unknown, fallback: string): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
}

function sanitizeAppearance(raw: CharacterAppearance): CharacterAppearance {
  return {
    gender: raw.gender === 'female' ? 'female' : 'male',
    skinTone: sanitizeHexColor(raw.skinTone, DEFAULT_APPEARANCE.skinTone),
    hairStyle: VALID_HAIR_STYLES.has(raw.hairStyle) ? raw.hairStyle : DEFAULT_APPEARANCE.hairStyle,
    hairColor: sanitizeHexColor(raw.hairColor, DEFAULT_APPEARANCE.hairColor),
    shirtStyle: VALID_SHIRT_STYLES.has(raw.shirtStyle)
      ? raw.shirtStyle
      : DEFAULT_APPEARANCE.shirtStyle,
    shirtColor: sanitizeHexColor(raw.shirtColor, DEFAULT_APPEARANCE.shirtColor),
    pantsColor: sanitizeHexColor(raw.pantsColor, DEFAULT_APPEARANCE.pantsColor),
    shoeColor: sanitizeHexColor(raw.shoeColor, DEFAULT_APPEARANCE.shoeColor),
    accessory: VALID_ACCESSORIES.has(raw.accessory) ? raw.accessory : DEFAULT_APPEARANCE.accessory,
  };
}

export async function createPlayerProfile(
  user: User,
  displayName: string,
  instagramId: string,
  appearance: CharacterAppearance,
  meta?: {
    age?: number;
    relationshipStatus?: RelationshipStatus;
    followedOfficial?: boolean;
    followedStudio?: boolean;
  },
): Promise<PlayerProfile> {
  const safeName = sanitizeDisplayName(displayName);
  const safeInsta = sanitizeInstagramId(instagramId);
  const safePhoto = (user.photoURL || '').slice(0, 512);
  const safeEmail = (user.email || '').slice(0, 256);
  const safeGoogleName = (user.displayName || safeName).slice(0, 128);
  const safeAge = Math.max(18, Math.min(90, Math.round(meta?.age ?? 22)));
  const safeRel: RelationshipStatus =
    meta?.relationshipStatus === 'mingle' ? 'mingle' : 'single';
  const followedOfficial = meta?.followedOfficial ?? true;
  const followedStudio = meta?.followedStudio ?? true;
  const safeAppearance = sanitizeAppearance(appearance);

  const playerPath = `players/${user.uid}`;
  const playerRef = doc(db, 'players', user.uid);
  const privateRef = doc(db, 'players', user.uid, 'private', 'account');

  // Ensure auth token is fresh for brand-new Email/Password or Google sign-ins
  await user.getIdToken().catch(() => {});

  // If the player profile already exists (e.g. retry, refresh, or prior creation), update cleanly instead of calling create
  const existingProfile = await loadPlayerProfile(user.uid).catch(() => null);
  if (existingProfile) {
    try {
      await savePlayerAppearance(user.uid, safeName, safeInsta, safePhoto || existingProfile.photoURL, safeAppearance, {
        age: safeAge,
        relationshipStatus: safeRel,
      });
    } catch {
      // Non-fatal: still let player enter Green Valley with their saved profile
    }
    return {
      ...existingProfile,
      displayName: safeName,
      instagramId: safeInsta,
      photoURL: safePhoto || existingProfile.photoURL,
      age: safeAge,
      relationshipStatus: safeRel,
      appearance: safeAppearance,
    };
  }

  const playerPayload = {
    uid: user.uid,
    displayName: safeName,
    instagramId: safeInsta,
    photoURL: safePhoto,
    age: safeAge,
    relationshipStatus: safeRel,
    partnerUid: '',
    partnerName: '',
    partnerInstagram: '',
    lastDailyLoginDate: '',
    dailyLoginStreak: 0,
    totalDailyLogins: 0,
    followedOfficial,
    followedStudio,
    customLocations: [],
    appearance: safeAppearance,
    greenCoins: 1500,
    level: 1,
    xp: 0,
    ownedProperties: [],
    ownedBusinesses: [],
    ownedVehicles: [],
    completedMissions: [],
    claimedRewards: [],
    inventory: [],
    friends: [],
    lastPosition: { ...WORLD_SPAWN },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(playerRef, playerPayload);
  } catch (error) {
    // Recovery path: if the profile was created in a parallel tab or double-click, load & update instead of failing
    const recovered = await loadPlayerProfile(user.uid).catch(() => null);
    if (recovered) {
      await savePlayerAppearance(user.uid, safeName, safeInsta, safePhoto || recovered.photoURL, safeAppearance, {
        age: safeAge,
        relationshipStatus: safeRel,
      }).catch(() => {});
      return {
        ...recovered,
        displayName: safeName,
        instagramId: safeInsta,
        photoURL: safePhoto || recovered.photoURL,
        age: safeAge,
        relationshipStatus: safeRel,
        appearance: safeAppearance,
      };
    }
    handleFirestoreError(error, OperationType.CREATE, playerPath);
  }

  // Create isolated private account PII document after parent profile exists
  const privatePath = `players/${user.uid}/private/account`;
  try {
    const existingPrivate = await getDoc(privateRef).catch(() => null);
    if (!existingPrivate?.exists()) {
      await setDoc(privateRef, {
        uid: user.uid,
        email: safeEmail,
        googleName: safeGoogleName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.warn(`Private account record sync skipped (${privatePath}):`, error);
  }

  return {
    uid: user.uid,
    displayName: safeName,
    instagramId: safeInsta,
    photoURL: safePhoto,
    age: safeAge,
    relationshipStatus: safeRel,
    partnerUid: '',
    partnerName: '',
    partnerInstagram: '',
    lastDailyLoginDate: '',
    dailyLoginStreak: 0,
    totalDailyLogins: 0,
    followedOfficial,
    followedStudio,
    customLocations: [],
    appearance: safeAppearance,
    greenCoins: 1500,
    level: 1,
    xp: 0,
    ownedProperties: [],
    ownedBusinesses: [],
    ownedVehicles: [],
    completedMissions: [],
    claimedRewards: [],
    inventory: [],
    friends: [],
    lastPosition: { ...WORLD_SPAWN },
  };
}

export async function savePlayerAppearance(
  uid: string,
  displayName: string,
  instagramId: string,
  photoURL: string,
  appearance: CharacterAppearance,
  meta?: { age?: number; relationshipStatus?: RelationshipStatus },
): Promise<void> {
  const path = `players/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      displayName: sanitizeDisplayName(displayName),
      instagramId: sanitizeInstagramId(instagramId),
      photoURL: photoURL.slice(0, 512),
      appearance: sanitizeAppearance(appearance),
      updatedAt: serverTimestamp(),
    };
    if (typeof meta?.age === 'number') {
      payload.age = Math.max(18, Math.min(90, Math.round(meta.age)));
    }
    if (meta?.relationshipStatus) {
      payload.relationshipStatus = meta.relationshipStatus;
    }
    await updateDoc(doc(db, 'players', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncPlayerProgressToFirestore(profile: PlayerProfile): Promise<void> {
  const path = `players/${profile.uid}`;
  try {
    await updateDoc(doc(db, 'players', profile.uid), {
      greenCoins: Math.max(0, Math.min(10000000, Math.round(profile.greenCoins))),
      level: Math.max(1, Math.min(100, Math.round(profile.level))),
      xp: Math.max(0, Math.min(1000000, Math.round(profile.xp))),
      ownedProperties: profile.ownedProperties.slice(0, 30),
      ownedBusinesses: profile.ownedBusinesses.slice(0, 10),
      ownedVehicles: profile.ownedVehicles.slice(0, 20),
      completedMissions: profile.completedMissions.slice(0, 50),
      claimedRewards: profile.claimedRewards.slice(0, 30),
      inventory: profile.inventory.slice(0, 30),
      friends: profile.friends.slice(0, 50),
      lastDailyLoginDate: profile.lastDailyLoginDate || '',
      dailyLoginStreak: Math.max(0, Math.min(365, Math.round(profile.dailyLoginStreak || 0))),
      totalDailyLogins: Math.max(0, Math.min(10000, Math.round(profile.totalDailyLogins || 0))),
      relationshipStatus: profile.relationshipStatus || 'single',
      partnerUid: (profile.partnerUid || '').slice(0, 128),
      partnerName: (profile.partnerName || '').slice(0, 32),
      partnerInstagram: sanitizeInstagramId(profile.partnerInstagram || ''),
      customLocations: sanitizeLocations(profile.customLocations),
      lastPosition: {
        x: Math.max(-500, Math.min(500, Number(profile.lastPosition.x.toFixed(2)))),
        y: Math.max(-50, Math.min(300, Number(profile.lastPosition.y.toFixed(2)))),
        z: Math.max(-500, Math.min(500, Number(profile.lastPosition.z.toFixed(2)))),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordWalletTransaction(
  uid: string,
  type: 'earn' | 'spend',
  amount: number,
  reason: string,
  balanceAfter: number,
): Promise<void> {
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `players/${uid}/transactions/${txId}`;
  try {
    await setDoc(doc(db, 'players', uid, 'transactions', txId), {
      uid,
      type,
      amount: Math.max(1, Math.min(50000, Math.round(amount))),
      reason: reason.trim().slice(0, 120) || 'Green Valley transaction',
      balanceAfter: Math.max(0, Math.min(10000000, Math.round(balanceAfter))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Optimized wallet transaction query — avoids composite index stalls by sorting client-side.
 */
export async function loadWalletTransactions(uid: string): Promise<WalletTransaction[]> {
  const path = `players/${uid}/transactions`;
  try {
    const q = query(
      collection(db, 'players', uid, 'transactions'),
      where('uid', '==', uid),
      limit(30),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
        return {
          id: docSnap.id,
          uid: String(d.uid || uid),
          type: (d.type === 'spend' ? 'spend' : 'earn') as 'earn' | 'spend',
          amount: Number(d.amount || 0),
          reason: String(d.reason || ''),
          balanceAfter: Number(d.balanceAfter || 0),
          createdAtMs: ts,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function loadWorldProperties(): Promise<Record<string, WorldPropertyOwnership>> {
  const path = 'properties';
  try {
    const q = query(collection(db, 'properties'), where('isPublic', '==', true));
    const snap = await getDocs(q);
    const result: Record<string, WorldPropertyOwnership> = {};
    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      result[docSnap.id] = {
        propertyId: docSnap.id,
        ownerUid: String(d.ownerUid || ''),
        ownerName: String(d.ownerName || 'Resident'),
        interiorTheme: (d.interiorTheme as InteriorTheme) || 'modern',
        gardenStyle: (d.gardenStyle as GardenStyle) || 'flowers',
      };
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveWorldPropertyClaim(
  propertyId: string,
  ownerUid: string,
  ownerName: string,
): Promise<void> {
  const path = `properties/${propertyId}`;
  try {
    await setDoc(doc(db, 'properties', propertyId), {
      propertyId,
      ownerUid,
      ownerName: sanitizeDisplayName(ownerName),
      interiorTheme: 'modern',
      gardenStyle: 'flowers',
      isPublic: true,
      purchasedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorldPropertyStyle(
  propertyId: string,
  ownerName: string,
  interiorTheme: InteriorTheme,
  gardenStyle: GardenStyle,
): Promise<void> {
  const path = `properties/${propertyId}`;
  try {
    await updateDoc(doc(db, 'properties', propertyId), {
      ownerName: sanitizeDisplayName(ownerName),
      interiorTheme,
      gardenStyle,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function loadCustomHomes(): Promise<Record<string, CustomHomeDef>> {
  const path = 'customHomes';
  try {
    const q = query(collection(db, 'customHomes'), where('isPublic', '==', true));
    const snap = await getDocs(q);
    const result: Record<string, CustomHomeDef> = {};
    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      result[docSnap.id] = {
        homeId: docSnap.id,
        name: String(d.name || 'Custom Home'),
        ownerUid: String(d.ownerUid || ''),
        ownerName: String(d.ownerName || 'Resident'),
        ownerInstagram: sanitizeInstagramId(String(d.ownerInstagram || '')),
        createdByAdmin: Boolean(d.createdByAdmin),
        style: (d.style as CustomHomeStyle) || 'modern',
        wallColor: String(d.wallColor || '#ece6da'),
        roofColor: String(d.roofColor || '#2c3e50'),
        hasPool: Boolean(d.hasPool),
        interiorTheme: (d.interiorTheme as InteriorTheme) || 'modern',
        gardenStyle: (d.gardenStyle as GardenStyle) || 'flowers',
        x: Number(d.x || 0),
        y: Number(d.y || 0),
        z: Number(d.z || 0),
      };
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCustomHomeToFirestore(home: CustomHomeDef): Promise<void> {
  const path = `customHomes/${home.homeId}`;
  try {
    await setDoc(doc(db, 'customHomes', home.homeId), {
      homeId: home.homeId,
      name: home.name.replace(/[^a-zA-Z0-9 _\-]/g, '').trim().slice(0, 32) || 'Custom Home',
      ownerUid: home.ownerUid,
      ownerName: sanitizeDisplayName(home.ownerName),
      ownerInstagram: sanitizeInstagramId(home.ownerInstagram),
      createdByAdmin: home.createdByAdmin,
      style: home.style,
      wallColor: home.wallColor,
      roofColor: home.roofColor,
      hasPool: home.hasPool,
      interiorTheme: home.interiorTheme,
      gardenStyle: home.gardenStyle,
      x: Number(home.x.toFixed(2)),
      y: Number(home.y.toFixed(2)),
      z: Number(home.z.toFixed(2)),
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCustomHomeFromFirestore(homeId: string): Promise<void> {
  const path = `customHomes/${homeId}`;
  try {
    await deleteDoc(doc(db, 'customHomes', homeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadCustomShops(): Promise<Record<string, CustomShopDef>> {
  const path = 'customShops';
  try {
    const q = query(collection(db, 'customShops'), where('isPublic', '==', true));
    const snap = await getDocs(q);
    const result: Record<string, CustomShopDef> = {};
    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      result[docSnap.id] = {
        shopId: docSnap.id,
        name: String(d.name || 'Valley Chaya Kada'),
        shopType: (d.shopType as CustomShopType) || 'tea_stall',
        ownerUid: String(d.ownerUid || ''),
        ownerName: String(d.ownerName || 'Shopkeeper'),
        ownerInstagram: sanitizeInstagramId(String(d.ownerInstagram || '')),
        awningColor: String(d.awningColor || '#e11d48'),
        x: Number(d.x || 0),
        y: Number(d.y || 0),
        z: Number(d.z || 0),
        totalSales: Number(d.totalSales || 0),
      };
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCustomShopToFirestore(shop: CustomShopDef): Promise<void> {
  const path = `customShops/${shop.shopId}`;
  try {
    await setDoc(doc(db, 'customShops', shop.shopId), {
      shopId: shop.shopId,
      name: shop.name.replace(/[^a-zA-Z0-9 _\-]/g, '').trim().slice(0, 32) || 'Valley Tea Stall',
      shopType: shop.shopType,
      ownerUid: shop.ownerUid,
      ownerName: sanitizeDisplayName(shop.ownerName),
      ownerInstagram: sanitizeInstagramId(shop.ownerInstagram),
      awningColor: shop.awningColor,
      x: Number(shop.x.toFixed(2)),
      y: Number(shop.y.toFixed(2)),
      z: Number(shop.z.toFixed(2)),
      totalSales: Math.max(0, Math.round(shop.totalSales || 0)),
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function incrementCustomShopSales(shopId: string, nextTotal: number): Promise<void> {
  const path = `customShops/${shopId}`;
  try {
    await updateDoc(doc(db, 'customShops', shopId), {
      totalSales: Math.max(0, Math.round(nextTotal)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomShopFromFirestore(shopId: string): Promise<void> {
  const path = `customShops/${shopId}`;
  try {
    await deleteDoc(doc(db, 'customShops', shopId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface VerifiedFollowerRecord {
  instagramId: string;
  followsOfficial: boolean;
  followsStudio: boolean;
  source: 'admin_sync' | 'instagram_export' | 'live_api';
}

export async function checkVerifiedFollowerInFirestore(
  rawInstagramId: string,
): Promise<VerifiedFollowerRecord | null> {
  const igDocId = sanitizeInstagramId(rawInstagramId).toLowerCase();
  if (!igDocId) return null;
  try {
    const snap = await getDoc(doc(db, 'verifiedFollowers', igDocId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      instagramId: igDocId,
      followsOfficial: Boolean(d.followsOfficial),
      followsStudio: Boolean(d.followsStudio),
      source:
        d.source === 'instagram_export' || d.source === 'live_api' ? d.source : 'admin_sync',
    };
  } catch {
    return null;
  }
}

export async function listVerifiedFollowersAdmin(): Promise<VerifiedFollowerRecord[]> {
  const path = 'verifiedFollowers';
  try {
    const snap = await getDocs(collection(db, 'verifiedFollowers'));
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          instagramId: String(d.instagramId || docSnap.id),
          followsOfficial: Boolean(d.followsOfficial),
          followsStudio: Boolean(d.followsStudio),
          source: (d.source === 'instagram_export' || d.source === 'live_api'
            ? d.source
            : 'admin_sync') as VerifiedFollowerRecord['source'],
        };
      })
      .sort((a, b) => a.instagramId.localeCompare(b.instagramId));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveVerifiedFollowersAdmin(
  records: VerifiedFollowerRecord[],
): Promise<number> {
  let saved = 0;
  const chunkSize = 350;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const rec of chunk) {
      const igDocId = sanitizeInstagramId(rec.instagramId).toLowerCase();
      if (!igDocId) continue;
      batch.set(doc(db, 'verifiedFollowers', igDocId), {
        instagramId: igDocId,
        followsOfficial: Boolean(rec.followsOfficial),
        followsStudio: Boolean(rec.followsStudio),
        source: rec.source,
        updatedAt: serverTimestamp(),
      });
      saved++;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'verifiedFollowers');
    }
  }
  return saved;
}

export async function removeVerifiedFollowerAdmin(rawInstagramId: string): Promise<void> {
  const igDocId = sanitizeInstagramId(rawInstagramId).toLowerCase();
  if (!igDocId) return;
  const path = `verifiedFollowers/${igDocId}`;
  try {
    await deleteDoc(doc(db, 'verifiedFollowers', igDocId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

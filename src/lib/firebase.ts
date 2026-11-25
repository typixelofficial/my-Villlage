import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
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
  orderBy,
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
  GardenStyle,
  InteriorTheme,
  PlayerProfile,
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

export async function signOutPlayer(): Promise<void> {
  await signOut(auth);
}

export async function loadPlayerProfile(uid: string): Promise<PlayerProfile | null> {
  const path = `players/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'players', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid || uid),
      displayName: sanitizeDisplayName(String(d.displayName || 'Valley Explorer')),
      instagramId: sanitizeInstagramId(String(d.instagramId || '')),
      photoURL: String(d.photoURL || ''),
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

export async function createPlayerProfile(
  user: User,
  displayName: string,
  instagramId: string,
  appearance: CharacterAppearance,
): Promise<PlayerProfile> {
  const safeName = sanitizeDisplayName(displayName);
  const safeInsta = sanitizeInstagramId(instagramId);
  const safePhoto = (user.photoURL || '').slice(0, 512);
  const safeEmail = (user.email || '').slice(0, 256);
  const safeGoogleName = (user.displayName || safeName).slice(0, 128);

  const playerPath = `players/${user.uid}`;
  const batch = writeBatch(db);
  const playerRef = doc(db, 'players', user.uid);
  const privateRef = doc(db, 'players', user.uid, 'private', 'account');

  batch.set(playerRef, {
    uid: user.uid,
    displayName: safeName,
    instagramId: safeInsta,
    photoURL: safePhoto,
    appearance,
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
  });

  batch.set(privateRef, {
    uid: user.uid,
    email: safeEmail,
    googleName: safeGoogleName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, playerPath);
  }

  return {
    uid: user.uid,
    displayName: safeName,
    instagramId: safeInsta,
    photoURL: safePhoto,
    appearance,
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
): Promise<void> {
  const path = `players/${uid}`;
  try {
    await updateDoc(doc(db, 'players', uid), {
      displayName: sanitizeDisplayName(displayName),
      instagramId: sanitizeInstagramId(instagramId),
      photoURL: photoURL.slice(0, 512),
      appearance,
      updatedAt: serverTimestamp(),
    });
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

export async function loadWalletTransactions(uid: string): Promise<WalletTransaction[]> {
  const path = `players/${uid}/transactions`;
  try {
    const q = query(
      collection(db, 'players', uid, 'transactions'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(25),
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
      return {
        id: docSnap.id,
        uid: String(d.uid || uid),
        type: d.type === 'spend' ? 'spend' : 'earn',
        amount: Number(d.amount || 0),
        reason: String(d.reason || ''),
        balanceAfter: Number(d.balanceAfter || 0),
        createdAtMs: ts,
      };
    });
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

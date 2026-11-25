import { io, type Socket } from 'socket.io-client';
import type { User } from 'firebase/auth';
import type {
  AnimationState,
  CharacterAppearance,
  ChatMessage,
  CustomHomeDef,
  CustomHomeStyle,
  EmoteType,
  FriendRequest,
  GardenStyle,
  InteriorTheme,
  NetworkPlayer,
  PlayerProfile,
  VehicleState,
  WorldPropertyOwnership,
} from '../shared/types.ts';
import { useGameStore } from '../store/gameStore.ts';
import {
  deleteCustomHomeFromFirestore,
  recordWalletTransaction,
  saveCustomHomeToFirestore,
  saveWorldPropertyClaim,
  syncPlayerProgressToFirestore,
  updateWorldPropertyStyle,
} from './firebase.ts';
import { playSfx } from '../game/audio.ts';

class MultiplayerClient {
  private socket: Socket | null = null;
  private lastEmitMs = 0;

  async connect(
    user: User,
    profile: PlayerProfile,
    knownProperties: WorldPropertyOwnership[],
    knownCustomHomes: CustomHomeDef[],
  ): Promise<void> {
    this.disconnect();
    const token = await user.getIdToken();
    const adminToken = useGameStore.getState().adminToken;

    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token, adminToken: adminToken || undefined },
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1200,
    });

    this.socket = socket;

    socket.on('connect', () => {
      useGameStore.getState().setSocketConnected(true);
      useGameStore.getState().setSessionReplacedMessage(null);
      const currentProfile = useGameStore.getState().profile || profile;
      socket.emit('player:join', {
        displayName: currentProfile.displayName,
        instagramId: currentProfile.instagramId,
        appearance: currentProfile.appearance,
        x: currentProfile.lastPosition.x,
        y: currentProfile.lastPosition.y,
        z: currentProfile.lastPosition.z,
        greenCoins: currentProfile.greenCoins,
        xp: currentProfile.xp,
        ownedProperties: currentProfile.ownedProperties,
        ownedBusinesses: currentProfile.ownedBusinesses,
        ownedVehicles: currentProfile.ownedVehicles,
        completedMissions: currentProfile.completedMissions,
        claimedRewards: currentProfile.claimedRewards,
        inventory: currentProfile.inventory,
        friends: currentProfile.friends,
        knownProperties,
        knownCustomHomes,
      });
    });

    socket.on('disconnect', () => {
      useGameStore.getState().setSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      useGameStore.getState().setSocketConnected(false);
      console.warn('Multiplayer connect_error:', err.message);
    });

    socket.on('session:replaced', (payload: { reason?: string }) => {
      useGameStore
        .getState()
        .setSessionReplacedMessage(payload?.reason || 'Signed in from another browser session.');
      socket.disconnect();
    });

    socket.on('admin:status', (payload: { isAdmin: boolean }) => {
      const store = useGameStore.getState();
      store.setAdminSession(Boolean(payload.isAdmin), store.adminToken);
      if (payload.isAdmin) {
        store.pushToast('Admin Studio Unlocked', 'You can now build homes for any player.', 'emerald');
      }
    });

    socket.on(
      'world:init',
      (payload: {
        selfUid: string;
        isAdmin?: boolean;
        players: NetworkPlayer[];
        vehicles: VehicleState[];
        properties: WorldPropertyOwnership[];
        customHomes?: CustomHomeDef[];
      }) => {
        const store = useGameStore.getState();
        if (payload.isAdmin) {
          store.setAdminSession(true, store.adminToken);
        }

        const remotes: Record<string, NetworkPlayer> = {};
        for (const p of payload.players) {
          if (p.uid !== payload.selfUid) {
            remotes[p.uid] = p;
          }
        }
        store.setRemotePlayers(remotes);
        store.setVehicles(payload.vehicles);

        const existingProps = { ...store.worldProperties };
        for (const prop of payload.properties) {
          existingProps[prop.propertyId] = prop;
        }
        store.setWorldProperties(existingProps);

        if (Array.isArray(payload.customHomes)) {
          const mergedHomes = { ...store.customHomes };
          for (const h of payload.customHomes) {
            mergedHomes[h.homeId] = h;
          }
          store.setCustomHomes(mergedHomes);
        }
      },
    );

    socket.on(
      'world:snapshot',
      (payload: { players: NetworkPlayer[]; vehicles: VehicleState[] }) => {
        const myUid = useGameStore.getState().firebaseUser?.uid;
        const remotes: Record<string, NetworkPlayer> = {};
        for (const p of payload.players) {
          if (p.uid !== myUid) {
            remotes[p.uid] = p;
          }
        }
        useGameStore.getState().setRemotePlayers(remotes);
        useGameStore.getState().setVehicles(payload.vehicles);
      },
    );

    socket.on('player:joined', (player: NetworkPlayer) => {
      const myUid = useGameStore.getState().firebaseUser?.uid;
      if (player.uid === myUid) return;
      useGameStore.getState().upsertRemotePlayer(player);
      const handleTag = player.instagramId ? ` (@${player.instagramId})` : '';
      useGameStore.getState().pushToast(`${player.displayName} joined Green Valley`, handleTag || undefined, 'sky');
      useGameStore.getState().addChatMessage({
        id: `sys_join_${player.uid}_${Date.now()}`,
        uid: 'system',
        displayName: 'Green Valley',
        photoURL: '',
        channel: 'system',
        text: `${player.displayName}${handleTag} entered Green Valley.`,
        timestamp: Date.now(),
      });
    });

    socket.on('player:left', (payload: { uid: string; displayName: string }) => {
      useGameStore.getState().removeRemotePlayer(payload.uid);
      useGameStore.getState().pushToast(`${payload.displayName} left Green Valley`, undefined, 'amber');
      useGameStore.getState().addChatMessage({
        id: `sys_left_${payload.uid}_${Date.now()}`,
        uid: 'system',
        displayName: 'Green Valley',
        photoURL: '',
        channel: 'system',
        text: `${payload.displayName} left the valley.`,
        timestamp: Date.now(),
      });
    });

    socket.on(
      'player:appearance',
      (payload: {
        uid: string;
        displayName: string;
        instagramId?: string;
        appearance: CharacterAppearance;
        isAdmin?: boolean;
      }) => {
        const existing = useGameStore.getState().remotePlayers[payload.uid];
        if (existing) {
          useGameStore.getState().upsertRemotePlayer({
            ...existing,
            displayName: payload.displayName,
            instagramId: payload.instagramId ?? existing.instagramId,
            appearance: payload.appearance,
            isAdmin: payload.isAdmin ?? existing.isAdmin,
          });
        }
      },
    );

    socket.on('player:emote', (payload: { uid: string; emote: EmoteType }) => {
      const existing = useGameStore.getState().remotePlayers[payload.uid];
      if (existing) {
        useGameStore.getState().upsertRemotePlayer({
          ...existing,
          anim: payload.emote,
          emoteUntil: Date.now() + 3400,
        });
      }
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      useGameStore.getState().addChatMessage(msg);
      if (msg.uid !== useGameStore.getState().firebaseUser?.uid) {
        playSfx('chat');
      }
    });

    socket.on('vehicle:updated', (veh: VehicleState) => {
      useGameStore.getState().updateVehicle(veh);
    });

    socket.on('vehicle:entered', (payload: { vehicleId: string }) => {
      const store = useGameStore.getState();
      store.setActiveVehicleId(payload.vehicleId);
      if (store.activePanel === 'vehicle_prompt') {
        store.setActivePanel(null);
      }
      playSfx('engineStart');
    });

    socket.on('vehicle:exited', () => {
      useGameStore.getState().setActiveVehicleId(null);
      playSfx('click');
    });

    socket.on('property:updated', (ownership: WorldPropertyOwnership) => {
      useGameStore.getState().upsertWorldProperty(ownership);
    });

    socket.on('customHome:created', (home: CustomHomeDef) => {
      useGameStore.getState().upsertCustomHome(home);
    });

    socket.on('customHome:deleted', (payload: { homeId: string }) => {
      useGameStore.getState().removeCustomHome(payload.homeId);
    });

    socket.on('admin:homeCreated', (payload: { home: CustomHomeDef }) => {
      useGameStore.getState().upsertCustomHome(payload.home);
      // Persist to Firestore (succeeds when signed in as Firebase admin or owner)
      void saveCustomHomeToFirestore(payload.home).catch(() => {});
    });

    socket.on('friend:incoming', (req: FriendRequest) => {
      useGameStore.getState().addFriendRequest(req);
      useGameStore
        .getState()
        .pushToast('Friend Request', `${req.fromName} wants to add you as a friend`, 'sky');
      playSfx('chat');
    });

    socket.on(
      'friends:update',
      async (payload: {
        friends: string[];
        toast?: { title: string; detail?: string; tone?: 'emerald' | 'amber' | 'sky' | 'rose' };
      }) => {
        useGameStore.getState().patchProfile({ friends: payload.friends });
        if (payload.toast) {
          useGameStore
            .getState()
            .pushToast(payload.toast.title, payload.toast.detail, payload.toast.tone || 'emerald');
        }
        const updated = useGameStore.getState().profile;
        if (updated) {
          void syncPlayerProgressToFirestore(updated).catch(() => {});
        }
      },
    );

    socket.on('toast:info', (payload: { title: string; detail?: string }) => {
      useGameStore.getState().pushToast(payload.title, payload.detail, 'sky');
    });

    socket.on('action:error', (payload: { message: string }) => {
      useGameStore.getState().pushToast('Action Unavailable', payload.message, 'rose');
    });

    socket.on(
      'economy:update',
      async (payload: {
        greenCoins: number;
        xp: number;
        level: number;
        ownedProperties?: string[];
        ownedBusinesses?: string[];
        ownedVehicles?: string[];
        completedMissions?: string[];
        claimedRewards?: string[];
        inventory?: string[];
        claimedProperty?: WorldPropertyOwnership;
        createdHome?: CustomHomeDef;
        businessCooldown?: { businessId: string; readyAt: number };
        workCooldown?: { jobId: string; readyAt: number };
        completedWorkId?: string;
        dailyRewardReadyAt?: number;
        healthRestore?: number;
        tx?: { type: 'earn' | 'spend'; amount: number; reason: string; balanceAfter: number };
        toast?: { title: string; detail?: string; tone?: 'emerald' | 'amber' | 'sky' | 'rose' };
      }) => {
        const store = useGameStore.getState();
        const patch: Partial<PlayerProfile> = {
          greenCoins: payload.greenCoins,
          xp: payload.xp,
          level: payload.level,
        };
        if (payload.ownedProperties) patch.ownedProperties = payload.ownedProperties;
        if (payload.ownedBusinesses) patch.ownedBusinesses = payload.ownedBusinesses;
        if (payload.ownedVehicles) patch.ownedVehicles = payload.ownedVehicles;
        if (payload.completedMissions) patch.completedMissions = payload.completedMissions;
        if (payload.claimedRewards) patch.claimedRewards = payload.claimedRewards;
        if (payload.inventory) patch.inventory = payload.inventory;

        store.patchProfile(patch);

        if (payload.businessCooldown) {
          store.setBusinessCooldown(
            payload.businessCooldown.businessId,
            payload.businessCooldown.readyAt,
          );
        }
        if (payload.workCooldown) {
          store.setWorkCooldown(payload.workCooldown.jobId, payload.workCooldown.readyAt);
        }
        if (payload.completedWorkId && store.activeWorkShift?.jobId === payload.completedWorkId) {
          store.setActiveWorkShift(null);
        }
        if (typeof payload.dailyRewardReadyAt === 'number' && payload.dailyRewardReadyAt > 0) {
          store.setDailyRewardReadyAt(payload.dailyRewardReadyAt);
        }
        if (payload.healthRestore) {
          store.setHealth(store.health + payload.healthRestore);
        }
        if (payload.toast) {
          store.pushToast(payload.toast.title, payload.toast.detail, payload.toast.tone || 'emerald');
          playSfx(payload.tx?.type === 'earn' ? 'coin' : 'click');
        }
        if (payload.tx && store.firebaseUser) {
          const txRecord = {
            id: `tx_${Date.now()}`,
            uid: store.firebaseUser.uid,
            type: payload.tx.type,
            amount: payload.tx.amount,
            reason: payload.tx.reason,
            balanceAfter: payload.tx.balanceAfter,
            createdAtMs: Date.now(),
          };
          store.prependTransaction(txRecord);
          void recordWalletTransaction(
            store.firebaseUser.uid,
            payload.tx.type,
            payload.tx.amount,
            payload.tx.reason,
            payload.tx.balanceAfter,
          ).catch(() => {});
        }
        if (payload.claimedProperty) {
          store.upsertWorldProperty(payload.claimedProperty);
          void saveWorldPropertyClaim(
            payload.claimedProperty.propertyId,
            payload.claimedProperty.ownerUid,
            payload.claimedProperty.ownerName,
          ).catch(() => {});
        }
        if (payload.createdHome) {
          store.upsertCustomHome(payload.createdHome);
          void saveCustomHomeToFirestore(payload.createdHome).catch(() => {});
        }
        const updatedProfile = useGameStore.getState().profile;
        if (updatedProfile) {
          void syncPlayerProgressToFirestore(updatedProfile).catch(() => {});
        }
      },
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    useGameStore.getState().setSocketConnected(false);
  }

  authenticateAdmin(adminToken: string): void {
    this.socket?.emit('admin:authenticate', { adminToken });
  }

  sendMove(
    x: number,
    y: number,
    z: number,
    rotY: number,
    anim: AnimationState,
    speed: number,
    teleport = false,
  ): void {
    if (!this.socket?.connected) return;
    const now = performance.now();
    if (!teleport && now - this.lastEmitMs < 50) return;
    this.lastEmitMs = now;
    this.socket.emit('player:move', { x, y, z, rotY, anim, speed, teleport });
  }

  sendAppearance(displayName: string, instagramId: string, appearance: CharacterAppearance): void {
    this.socket?.emit('player:appearance', { displayName, instagramId, appearance });
  }

  sendEmote(emote: EmoteType): void {
    this.socket?.emit('player:emote', { emote });
  }

  sendChat(text: string, channel: 'global' | 'proximity'): void {
    this.socket?.emit('chat:send', { text, channel });
  }

  enterVehicle(vehicleId: string, mode: 'free' | 'rent' | 'buy' = 'free'): void {
    this.socket?.emit('vehicle:enter', { vehicleId, mode });
  }

  exitVehicle(): void {
    this.socket?.emit('vehicle:exit', {});
  }

  completeMission(missionId: string): void {
    this.socket?.emit('mission:complete', { missionId });
  }

  completeWork(jobId: string): void {
    this.socket?.emit('work:complete', { jobId });
  }

  claimReward(rewardId: string): void {
    this.socket?.emit('reward:claim', { rewardId });
  }

  buildPlayerHome(opts: {
    name: string;
    style: CustomHomeStyle;
    wallColor: string;
    roofColor: string;
    hasPool: boolean;
    interiorTheme: InteriorTheme;
    gardenStyle: GardenStyle;
    x: number;
    z: number;
  }): void {
    this.socket?.emit('home:build', opts);
  }

  adminBuildHome(opts: {
    targetUid?: string;
    ownerName: string;
    ownerInstagram?: string;
    name: string;
    style: CustomHomeStyle;
    wallColor: string;
    roofColor: string;
    hasPool: boolean;
    interiorTheme: InteriorTheme;
    gardenStyle: GardenStyle;
    x: number;
    z: number;
  }): void {
    this.socket?.emit('admin:buildHome', opts);
  }

  adminDeleteHome(homeId: string): void {
    this.socket?.emit('admin:deleteHome', { homeId });
    void deleteCustomHomeFromFirestore(homeId).catch(() => {});
  }

  adminGrantCoins(targetUid: string, amount: number): void {
    this.socket?.emit('admin:grantCoins', { targetUid, amount });
  }

  buyProperty(propertyId: string): void {
    this.socket?.emit('property:buy', { propertyId });
  }

  customizeProperty(
    propertyId: string,
    ownerName: string,
    interiorTheme: InteriorTheme,
    gardenStyle: GardenStyle,
  ): void {
    this.socket?.emit('property:customize', { propertyId, interiorTheme, gardenStyle });
    void updateWorldPropertyStyle(propertyId, ownerName, interiorTheme, gardenStyle).catch(() => {});
  }

  buyBusiness(businessId: string): void {
    this.socket?.emit('business:buy', { businessId });
  }

  collectBusiness(businessId: string): void {
    this.socket?.emit('business:collect', { businessId });
  }

  buyShopItem(itemId: string): void {
    this.socket?.emit('shop:buy', { itemId });
  }

  useInventoryItem(itemId: string): void {
    this.socket?.emit('inventory:use', { itemId });
  }

  sendFriendRequest(targetUid: string): void {
    this.socket?.emit('friend:request', { targetUid });
  }

  acceptFriendRequest(fromUid: string): void {
    this.socket?.emit('friend:accept', { fromUid });
    useGameStore.getState().removeFriendRequest(fromUid);
  }
}

export const multiplayer = new MultiplayerClient();

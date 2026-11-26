import { io, type Socket } from 'socket.io-client';
import type { User } from 'firebase/auth';
import type {
  AnimationState,
  CharacterAppearance,
  ChatMessage,
  CustomHomeDef,
  CustomHomeStyle,
  CustomShopDef,
  CustomShopType,
  EmoteType,
  FriendRequest,
  GardenStyle,
  InteriorTheme,
  MingleEventState,
  MingleParticipant,
  NetworkPlayer,
  PlayerProfile,
  RelationshipStatus,
  VehicleState,
  WorldPropertyOwnership,
} from '../shared/types.ts';
import {
  ACTIVE_BUILDINGS,
  BUSINESSES,
  CUSTOM_HOME_PLANS,
  CUSTOM_SHOP_PLANS,
  DAILY_LOGIN_REWARDS,
  MINGLE_MEETUP_LOCATIONS,
  PROPERTIES,
  REWARDS,
  SHOP_ITEMS,
  VALLEY_SINGLES,
  groundHeightAt,
} from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';
import {
  deleteCustomHomeFromFirestore,
  deleteCustomShopFromFirestore,
  getTodayDateKey,
  getYesterdayDateKey,
  incrementCustomShopSales,
  recordWalletTransaction,
  saveCustomHomeToFirestore,
  saveCustomShopToFirestore,
  saveWorldPropertyClaim,
  syncPlayerProgressToFirestore,
  updateWorldPropertyStyle,
} from './firebase.ts';
import { playSfx } from '../game/audio.ts';
import { voiceChat } from './voiceChat.ts';

function levelFromXp(xp: number): number {
  return Math.max(1, Math.min(100, Math.floor(xp / 250) + 1));
}

class MultiplayerClient {
  private socket: Socket | null = null;
  private lastEmitMs = 0;

  private applyLocalTransaction(
    patch: Partial<PlayerProfile>,
    tx?: { type: 'earn' | 'spend'; amount: number; reason: string; balanceAfter: number },
    toast?: { title: string; detail?: string; tone?: 'emerald' | 'amber' | 'sky' | 'rose' },
    healthRestore?: number,
  ): void {
    const store = useGameStore.getState();
    store.patchProfile(patch);
    if (healthRestore) {
      store.setHealth(store.health + healthRestore);
    }
    if (toast) {
      store.pushToast(toast.title, toast.detail, toast.tone || 'emerald');
      playSfx(tx?.type === 'earn' ? 'coin' : 'click');
    }
    if (tx && store.firebaseUser) {
      store.prependTransaction({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        uid: store.firebaseUser.uid,
        type: tx.type,
        amount: tx.amount,
        reason: tx.reason,
        balanceAfter: tx.balanceAfter,
        createdAtMs: Date.now(),
      });
      void recordWalletTransaction(
        store.firebaseUser.uid,
        tx.type,
        tx.amount,
        tx.reason,
        tx.balanceAfter,
      ).catch(() => {});
    }
    const updated = useGameStore.getState().profile;
    if (updated) {
      void syncPlayerProgressToFirestore(updated).catch(() => {});
    }
  }

  async connect(
    user: User,
    profile: PlayerProfile,
    knownProperties: WorldPropertyOwnership[],
    knownCustomHomes: CustomHomeDef[],
    knownCustomShops: CustomShopDef[] = [],
  ): Promise<void> {
    this.disconnect();
    const token = await user.getIdToken();

    // Use polling -> websocket upgrade so Cloud Run proxies connect instantly & reliably
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 900,
    });

    this.socket = socket;

    voiceChat.bindSignaling({
      emitJoin: (muted) => socket.emit('voice:join', { muted }),
      emitLeave: () => socket.emit('voice:leave', {}),
      emitState: (muted) => socket.emit('voice:state', { muted }),
      emitOffer: (targetUid, sdp) => socket.emit('voice:offer', { targetUid, sdp }),
      emitAnswer: (targetUid, sdp) => socket.emit('voice:answer', { targetUid, sdp }),
      emitIce: (targetUid, candidate) => socket.emit('voice:ice', { targetUid, candidate }),
    });

    socket.on('connect', () => {
      const store = useGameStore.getState();
      store.setSocketConnected(true);
      store.setSessionReplacedMessage(null);
      const currentProfile = store.profile || profile;
      const latestProps = Object.values(store.worldProperties);
      const latestHomes = Object.values(store.customHomes);
      const latestShops = Object.values(store.customShops);
      socket.emit('player:join', {
        displayName: currentProfile.displayName,
        instagramId: currentProfile.instagramId,
        age: currentProfile.age,
        relationshipStatus: currentProfile.relationshipStatus,
        partnerName: currentProfile.partnerName,
        lastDailyLoginDate: currentProfile.lastDailyLoginDate,
        dailyLoginStreak: currentProfile.dailyLoginStreak,
        totalDailyLogins: currentProfile.totalDailyLogins,
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
        knownProperties: latestProps.length ? latestProps : knownProperties,
        knownCustomHomes: latestHomes.length ? latestHomes : knownCustomHomes,
        knownCustomShops: latestShops.length ? latestShops : knownCustomShops,
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

    socket.on(
      'world:init',
      (payload: {
        selfUid: string;
        isAdmin?: boolean;
        players: NetworkPlayer[];
        vehicles: VehicleState[];
        properties: WorldPropertyOwnership[];
        customHomes?: CustomHomeDef[];
        customShops?: CustomShopDef[];
        mingleEvent?: MingleEventState;
        voicePeers?: { uid: string; muted: boolean }[];
      }) => {
        const store = useGameStore.getState();
        store.setIsAdmin(Boolean(payload.isAdmin));

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

        if (Array.isArray(payload.customShops)) {
          const mergedShops = { ...store.customShops };
          for (const sh of payload.customShops) {
            mergedShops[sh.shopId] = sh;
          }
          store.setCustomShops(mergedShops);
        }

        if (payload.mingleEvent) {
          store.setMingleEvent(payload.mingleEvent);
        }

        if (Array.isArray(payload.voicePeers) && payload.voicePeers.length > 0) {
          voiceChat.handleVoicePeers(payload.voicePeers);
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
      useGameStore
        .getState()
        .pushToast(`${player.displayName} joined Green Valley`, handleTag || undefined, 'sky');
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
        age?: number;
        relationshipStatus?: RelationshipStatus;
        isAdmin?: boolean;
      }) => {
        const existing = useGameStore.getState().remotePlayers[payload.uid];
        if (existing) {
          useGameStore.getState().upsertRemotePlayer({
            ...existing,
            displayName: payload.displayName,
            instagramId: payload.instagramId ?? existing.instagramId,
            appearance: payload.appearance,
            age: payload.age ?? existing.age,
            relationshipStatus: payload.relationshipStatus ?? existing.relationshipStatus,
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

    // WebRTC Voice Signaling
    socket.on('voice:peers', (payload: { peers: { uid: string; muted: boolean }[] }) => {
      if (Array.isArray(payload?.peers)) voiceChat.handleVoicePeers(payload.peers);
    });
    socket.on('voice:user-joined', (payload: { uid: string; muted: boolean }) => {
      if (payload?.uid) voiceChat.handlePeerJoined(payload.uid, Boolean(payload.muted));
    });
    socket.on('voice:user-left', (payload: { uid: string }) => {
      if (payload?.uid) voiceChat.handlePeerLeft(payload.uid);
    });
    socket.on('voice:state', (payload: { uid: string; muted: boolean }) => {
      if (payload?.uid) voiceChat.handlePeerState(payload.uid, Boolean(payload.muted));
    });
    socket.on('voice:offer', (payload: { fromUid: string; sdp: RTCSessionDescriptionInit }) => {
      if (payload?.fromUid && payload?.sdp) void voiceChat.handleOffer(payload.fromUid, payload.sdp);
    });
    socket.on('voice:answer', (payload: { fromUid: string; sdp: RTCSessionDescriptionInit }) => {
      if (payload?.fromUid && payload?.sdp) void voiceChat.handleAnswer(payload.fromUid, payload.sdp);
    });
    socket.on('voice:ice', (payload: { fromUid: string; candidate: RTCIceCandidateInit }) => {
      if (payload?.fromUid && payload?.candidate) void voiceChat.handleIce(payload.fromUid, payload.candidate);
    });

    socket.on('vehicle:updated', (veh: VehicleState) => {
      useGameStore.getState().updateVehicle(veh);
    });

    socket.on('vehicle:entered', (payload: { vehicleId: string }) => {
      const store = useGameStore.getState();
      store.setActiveVehicleId(payload.vehicleId);
      if (store.activePanel === 'vehicle_prompt') store.setActivePanel(null);
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

    socket.on('customShop:created', (shop: CustomShopDef) => {
      useGameStore.getState().upsertCustomShop(shop);
    });

    socket.on('customShop:updated', (shop: CustomShopDef) => {
      useGameStore.getState().upsertCustomShop(shop);
    });

    socket.on('customShop:deleted', (payload: { shopId: string }) => {
      useGameStore.getState().removeCustomShop(payload.shopId);
    });

    socket.on('admin:homeCreated', (payload: { home: CustomHomeDef }) => {
      useGameStore.getState().upsertCustomHome(payload.home);
      void saveCustomHomeToFirestore(payload.home).catch(() => {});
    });

    // Single-to-Mingle Real-time Events
    socket.on('mingle:update', (ev: MingleEventState) => {
      const prevMatchId = useGameStore.getState().mingleEvent.selectedPair?.matchId;
      useGameStore.getState().setMingleEvent(ev);
      if (ev.selectedPair && ev.selectedPair.matchId !== prevMatchId) {
        playSfx('alarm');
      }
    });

    socket.on('mingle:alarm', (payload: { locationName: string; locationPos: { x: number; y: number; z: number }; nextEventAtMs: number }) => {
      const store = useGameStore.getState();
      store.patchMingleEvent({
        alarmActive: true,
        locationName: payload.locationName,
        locationPos: payload.locationPos,
        nextEventAtMs: payload.nextEventAtMs,
      });
      store.setWaypointTarget({
        x: payload.locationPos.x,
        z: payload.locationPos.z,
        label: `Mingle: ${payload.locationName}`,
      });
      playSfx('alarm');
      store.pushToast(
        '5-Min Single-to-Mingle Alarm!',
        `Head to ${payload.locationName} for hourly matchmaking!`,
        'rose',
      );
    });

    socket.on(
      'mingle:married',
      (payload: {
        partnerUid: string;
        partnerName: string;
        partnerInstagram: string;
        mingleEvent?: MingleEventState;
      }) => {
        const store = useGameStore.getState();
        store.patchProfile({
          relationshipStatus: 'married',
          partnerUid: payload.partnerUid,
          partnerName: payload.partnerName,
          partnerInstagram: payload.partnerInstagram,
        });
        if (payload.mingleEvent) {
          store.setMingleEvent(payload.mingleEvent);
        }
        playSfx('wedding');
        store.pushToast(
          `Congratulations! Married to ${payload.partnerName}!`,
          'Enjoy the Grand Wedding Feast & Lakeside Honeymoon!',
          'rose',
        );
        const updated = useGameStore.getState().profile;
        if (updated) void syncPlayerProgressToFirestore(updated).catch(() => {});
      },
    );

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
        if (updated) void syncPlayerProgressToFirestore(updated).catch(() => {});
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
        lastDailyLoginDate?: string;
        dailyLoginStreak?: number;
        totalDailyLogins?: number;
        claimedProperty?: WorldPropertyOwnership;
        createdHome?: CustomHomeDef;
        createdShop?: CustomShopDef;
        updatedShop?: CustomShopDef;
        businessCooldown?: { businessId: string; readyAt: number };
        workCooldown?: { jobId: string; readyAt: number };
        completedWorkId?: string;
        dailyRewardReadyAt?: number;
        healthRestore?: number;
        teleportTo?: { x: number; y: number; z: number };
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
        if (typeof payload.lastDailyLoginDate === 'string')
          patch.lastDailyLoginDate = payload.lastDailyLoginDate;
        if (typeof payload.dailyLoginStreak === 'number')
          patch.dailyLoginStreak = payload.dailyLoginStreak;
        if (typeof payload.totalDailyLogins === 'number')
          patch.totalDailyLogins = payload.totalDailyLogins;

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
        if (payload.teleportTo) {
          store.requestTeleport(payload.teleportTo);
        }
        if (payload.toast) {
          store.pushToast(payload.toast.title, payload.toast.detail, payload.toast.tone || 'emerald');
          playSfx(payload.tx?.type === 'earn' ? 'coin' : 'click');
        }
        if (payload.tx && store.firebaseUser) {
          store.prependTransaction({
            id: `tx_${Date.now()}`,
            uid: store.firebaseUser.uid,
            type: payload.tx.type,
            amount: payload.tx.amount,
            reason: payload.tx.reason,
            balanceAfter: payload.tx.balanceAfter,
            createdAtMs: Date.now(),
          });
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
        if (payload.createdShop) {
          store.upsertCustomShop(payload.createdShop);
          void saveCustomShopToFirestore(payload.createdShop).catch(() => {});
        }
        if (payload.updatedShop) {
          store.upsertCustomShop(payload.updatedShop);
          void incrementCustomShopSales(
            payload.updatedShop.shopId,
            payload.updatedShop.totalSales,
          ).catch(() => {});
        }
        const updatedProfile = useGameStore.getState().profile;
        if (updatedProfile) {
          void syncPlayerProgressToFirestore(updatedProfile).catch(() => {});
        }
      },
    );
  }

  disconnect(): void {
    voiceChat.leaveVoice(true);
    voiceChat.bindSignaling(null);
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    useGameStore.getState().setSocketConnected(false);
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

  sendAppearance(
    displayName: string,
    instagramId: string,
    appearance: CharacterAppearance,
    age?: number,
    relationshipStatus?: RelationshipStatus,
  ): void {
    this.socket?.emit('player:appearance', {
      displayName,
      instagramId,
      appearance,
      age,
      relationshipStatus,
    });
  }

  sendEmote(emote: EmoteType): void {
    this.socket?.emit('player:emote', { emote });
  }

  sendChat(text: string, channel: 'global' | 'proximity' | 'direct', targetUid?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:send', { text, channel, targetUid });
    } else {
      const store = useGameStore.getState();
      if (!store.profile) return;
      store.addChatMessage({
        id: `local_${Date.now()}`,
        uid: store.profile.uid,
        displayName: store.profile.displayName,
        instagramId: store.profile.instagramId || undefined,
        photoURL: store.profile.photoURL,
        channel,
        text,
        timestamp: Date.now(),
      });
    }
  }

  // Daily Login Reward (works both online via Socket.IO AND with instant Firestore fallback)
  claimDailyLogin(): void {
    if (this.socket?.connected) {
      this.socket.emit('daily:claim', {});
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    if (!profile) return;
    const today = getTodayDateKey();
    if (profile.lastDailyLoginDate === today) {
      store.pushToast('Already Claimed Today', 'Come back tomorrow to continue your streak!', 'amber');
      return;
    }
    const yesterday = getYesterdayDateKey();
    const nextStreak =
      profile.lastDailyLoginDate === yesterday ? (profile.dailyLoginStreak || 0) + 1 : 1;
    const tier = DAILY_LOGIN_REWARDS[(nextStreak - 1) % DAILY_LOGIN_REWARDS.length];
    const nextCoins = Math.min(10000000, profile.greenCoins + tier.coins);
    const nextXp = profile.xp + tier.xp;
    this.applyLocalTransaction(
      {
        greenCoins: nextCoins,
        xp: nextXp,
        level: levelFromXp(nextXp),
        lastDailyLoginDate: today,
        dailyLoginStreak: nextStreak,
        totalDailyLogins: (profile.totalDailyLogins || 0) + 1,
      },
      {
        type: 'earn',
        amount: tier.coins,
        reason: `Daily Login Reward (Day ${nextStreak})`,
        balanceAfter: nextCoins,
      },
      {
        title: `Day ${nextStreak} Daily Reward: +${tier.coins} GC!`,
        detail: `${tier.label} · +${tier.xp} XP`,
        tone: 'amber',
      },
    );
  }

  enterVehicle(vehicleId: string, mode: 'free' | 'rent' | 'buy' = 'free'): void {
    if (this.socket?.connected) {
      this.socket.emit('vehicle:enter', { vehicleId, mode });
      return;
    }
    // Offline-resilient fallback so players can ALWAYS spend coins & drive
    const store = useGameStore.getState();
    const profile = store.profile;
    const veh = store.vehicles[vehicleId];
    if (!profile || !veh) return;
    const isOwned = profile.ownedVehicles.includes(veh.id);
    const isFree = veh.rentPrice <= 0 && veh.buyPrice <= 0;
    if (!store.isAdmin && !isFree && !isOwned) {
      if (mode === 'rent') {
        if (profile.greenCoins < veh.rentPrice) {
          store.pushToast('Insufficient Coins', `Need ${veh.rentPrice} GC to rent ${veh.name}.`, 'rose');
          return;
        }
        const bal = profile.greenCoins - veh.rentPrice;
        this.applyLocalTransaction(
          { greenCoins: bal },
          { type: 'spend', amount: veh.rentPrice, reason: `Rented ${veh.name}`, balanceAfter: bal },
          { title: `Rented ${veh.name}`, detail: `-${veh.rentPrice} GC · Enjoy the drive!`, tone: 'amber' },
        );
      } else if (mode === 'buy') {
        if (profile.greenCoins < veh.buyPrice) {
          store.pushToast('Insufficient Coins', `Need ${veh.buyPrice} GC to unlock ${veh.name}.`, 'rose');
          return;
        }
        const bal = profile.greenCoins - veh.buyPrice;
        this.applyLocalTransaction(
          { greenCoins: bal, ownedVehicles: [...profile.ownedVehicles, veh.id] },
          { type: 'spend', amount: veh.buyPrice, reason: `Bought ${veh.name}`, balanceAfter: bal },
          { title: `Unlocked ${veh.name}`, detail: 'Drive anytime for free!', tone: 'emerald' },
        );
      } else {
        store.pushToast('Payment Required', `Rent for ${veh.rentPrice} GC or buy for ${veh.buyPrice} GC.`, 'amber');
        return;
      }
    }
    store.updateVehicle({ ...veh, driverUid: profile.uid });
    store.setActiveVehicleId(veh.id);
    if (store.activePanel === 'vehicle_prompt') store.setActivePanel(null);
    playSfx('engineStart');
  }

  exitVehicle(): void {
    if (this.socket?.connected) {
      this.socket.emit('vehicle:exit', {});
      return;
    }
    const store = useGameStore.getState();
    if (store.activeVehicleId && store.vehicles[store.activeVehicleId]) {
      store.updateVehicle({ ...store.vehicles[store.activeVehicleId], driverUid: null, speed: 0 });
    }
    store.setActiveVehicleId(null);
    playSfx('click');
  }

  completeMission(missionId: string): void {
    this.socket?.emit('mission:complete', { missionId });
  }

  completeWork(jobId: string): void {
    this.socket?.emit('work:complete', { jobId });
  }

  claimReward(rewardId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('reward:claim', { rewardId });
      return;
    }
    // Resilient fallback so Claim Reward NEVER fails silently!
    const store = useGameStore.getState();
    const profile = store.profile;
    const reward = REWARDS.find((r) => r.id === rewardId);
    if (!profile || !reward) return;
    const now = Date.now();
    if (reward.repeatableSec) {
      if (now < store.dailyRewardReadyAt) {
        const secs = Math.ceil((store.dailyRewardReadyAt - now) / 1000);
        store.pushToast('Cooldown Active', `Next check-in ready in ${secs}s.`, 'amber');
        return;
      }
      store.setDailyRewardReadyAt(now + reward.repeatableSec * 1000);
    } else {
      if (profile.claimedRewards.includes(reward.id)) {
        store.pushToast('Already Claimed', 'You already claimed this milestone.', 'amber');
        return;
      }
      if (reward.id === 'rew-insta-profile' && profile.instagramId.length < 2) {
        store.pushToast('Add Instagram ID', 'Add your Instagram username in Customize first.', 'rose');
        return;
      }
      if (reward.id === 'rew-first-home') {
        const ownsCustom = Object.values(store.customHomes).some((h) => h.ownerUid === profile.uid);
        if (profile.ownedProperties.length === 0 && !ownsCustom) {
          store.pushToast('Home Required', 'Buy or build your first home first.', 'rose');
          return;
        }
      }
      if (reward.id === 'rew-vehicle-owner' && profile.ownedVehicles.length === 0) {
        store.pushToast('Vehicle Required', 'Unlock any paid vehicle permanently first.', 'rose');
        return;
      }
      if (reward.id === 'rew-mission-ace' && profile.completedMissions.length < 2) {
        store.pushToast('Missions Required', 'Complete at least 2 missions first.', 'rose');
        return;
      }
    }
    const nextCoins = Math.min(10000000, profile.greenCoins + reward.coins);
    const nextXp = profile.xp + reward.xp;
    this.applyLocalTransaction(
      {
        greenCoins: nextCoins,
        xp: nextXp,
        level: levelFromXp(nextXp),
        claimedRewards: reward.repeatableSec
          ? profile.claimedRewards
          : [...profile.claimedRewards, reward.id],
      },
      {
        type: 'earn',
        amount: reward.coins,
        reason: `Reward: ${reward.title}`,
        balanceAfter: nextCoins,
      },
      {
        title: `Reward Claimed: +${reward.coins} GC`,
        detail: `${reward.title} · +${reward.xp} XP`,
        tone: 'amber',
      },
    );
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
    if (this.socket?.connected) {
      this.socket.emit('home:build', opts);
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const plan = CUSTOM_HOME_PLANS.find((p) => p.style === opts.style);
    if (!profile || !plan) return;
    const cost = store.isAdmin ? 0 : plan.price;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC to build ${plan.label}.`, 'rose');
      return;
    }
    const homeId = `home_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const y = Math.max(0, groundHeightAt(opts.x, opts.z));
    const home: CustomHomeDef = {
      homeId,
      name: opts.name.trim().slice(0, 32) || `${profile.displayName}'s Home`,
      ownerUid: profile.uid,
      ownerName: profile.displayName,
      ownerInstagram: profile.instagramId,
      createdByAdmin: store.isAdmin,
      style: opts.style,
      wallColor: opts.wallColor,
      roofColor: opts.roofColor,
      hasPool: opts.hasPool,
      interiorTheme: opts.interiorTheme,
      gardenStyle: opts.gardenStyle,
      x: Number(opts.x.toFixed(1)),
      y: Number(y.toFixed(2)),
      z: Number(opts.z.toFixed(1)),
    };
    const nextCoins = profile.greenCoins - cost;
    store.upsertCustomHome(home);
    void saveCustomHomeToFirestore(home).catch(() => {});
    this.applyLocalTransaction(
      { greenCoins: nextCoins, ownedProperties: [...profile.ownedProperties, homeId] },
      cost > 0
        ? { type: 'spend', amount: cost, reason: `Built ${home.name}`, balanceAfter: nextCoins }
        : undefined,
      { title: `Home Built: ${home.name}`, detail: 'Saved to Green Valley!', tone: 'emerald' },
    );
  }

  // Anyone can open a 3D Shop (Tea Stall / Chaya Kada, Juice Bar, Bakery, Boutique, Tech Shop)
  openCustomShop(opts: {
    name: string;
    shopType: CustomShopType;
    awningColor: string;
    x: number;
    z: number;
  }): void {
    if (this.socket?.connected) {
      this.socket.emit('shop:open', opts);
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const plan = CUSTOM_SHOP_PLANS.find((p) => p.shopType === opts.shopType);
    if (!profile || !plan) return;
    const cost = store.isAdmin ? 0 : plan.price;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC to start ${plan.label}.`, 'rose');
      return;
    }
    const shopId = `shop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const y = Math.max(0, groundHeightAt(opts.x, opts.z));
    const shop: CustomShopDef = {
      shopId,
      name: opts.name.trim().slice(0, 32) || `${profile.displayName}'s ${plan.label}`,
      shopType: opts.shopType,
      ownerUid: profile.uid,
      ownerName: profile.displayName,
      ownerInstagram: profile.instagramId,
      awningColor: opts.awningColor || plan.defaultAwning,
      x: Number(opts.x.toFixed(1)),
      y: Number(y.toFixed(2)),
      z: Number(opts.z.toFixed(1)),
      totalSales: 0,
    };
    const nextCoins = profile.greenCoins - cost;
    store.upsertCustomShop(shop);
    void saveCustomShopToFirestore(shop).catch(() => {});
    this.applyLocalTransaction(
      { greenCoins: nextCoins },
      cost > 0
        ? { type: 'spend', amount: cost, reason: `Opened ${shop.name}`, balanceAfter: nextCoins }
        : undefined,
      {
        title: `Shop Opened: ${shop.name}`,
        detail: `Customers can now buy from your ${plan.label}!`,
        tone: 'emerald',
      },
    );
  }

  buyFromCustomShop(shopId: string, menuItemId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('shop:purchaseFromPlayer', { shopId, menuItemId });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const shop = store.customShops[shopId];
    if (!profile || !shop) return;
    const plan = CUSTOM_SHOP_PLANS.find((p) => p.shopType === shop.shopType);
    const item = plan?.menuItems.find((i) => i.id === menuItemId);
    if (!item) return;
    const cost = store.isAdmin ? 0 : item.price;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC for ${item.name}.`, 'rose');
      return;
    }
    const nextCoins = profile.greenCoins - cost;
    const nextXp = profile.xp + item.xp;
    const updatedShop = { ...shop, totalSales: shop.totalSales + 1 };
    store.upsertCustomShop(updatedShop);
    void incrementCustomShopSales(shop.shopId, updatedShop.totalSales).catch(() => {});
    this.applyLocalTransaction(
      { greenCoins: nextCoins, xp: nextXp, level: levelFromXp(nextXp) },
      cost > 0
        ? { type: 'spend', amount: cost, reason: `${item.name} @ ${shop.name}`, balanceAfter: nextCoins }
        : undefined,
      {
        title: `Enjoyed ${item.name}!`,
        detail: `+${item.healthRestore} HP · +${item.xp} XP`,
        tone: 'emerald',
      },
      item.healthRestore,
    );
  }

  deleteCustomShop(shopId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('shop:delete', { shopId });
    } else {
      useGameStore.getState().removeCustomShop(shopId);
    }
    void deleteCustomShopFromFirestore(shopId).catch(() => {});
  }

  useBuildingService(buildingId: string, serviceId: string): void {
    const store = useGameStore.getState();
    const bldg = ACTIVE_BUILDINGS.find((b) => b.id === buildingId);
    const svc = bldg?.services.find((s) => s.id === serviceId);
    if (!bldg || !svc) return;

    if (svc.openPanel) {
      store.setActivePanel(svc.openPanel);
      return;
    }

    if (this.socket?.connected) {
      this.socket.emit('building:service', { buildingId, serviceId });
      return;
    }

    const profile = store.profile;
    if (!profile) return;
    const cost = store.isAdmin ? 0 : svc.cost;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC for ${svc.label}.`, 'rose');
      return;
    }
    const gain = svc.rewardCoins || 0;
    const nextCoins = Math.min(10000000, profile.greenCoins - cost + gain);
    const nextXp = profile.xp + (svc.rewardXp || 0);
    if (svc.teleportTo) {
      store.requestTeleport(svc.teleportTo);
      store.setActivePanel(null);
    }
    this.applyLocalTransaction(
      { greenCoins: nextCoins, xp: nextXp, level: levelFromXp(nextXp) },
      cost > 0
        ? { type: 'spend', amount: cost, reason: `${bldg.name}: ${svc.label}`, balanceAfter: nextCoins }
        : gain > 0
          ? { type: 'earn', amount: gain, reason: `${bldg.name}: ${svc.label}`, balanceAfter: nextCoins }
          : undefined,
      {
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
      svc.healthRestore,
    );
  }

  // Free Single-to-Mingle Actions (0 GC — No Money Needed, Live Joined Pool + Auto-Select 2 Accounts + DPs)
  joinMingle(): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:join', {});
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    if (!profile) return;
    const selfPart: MingleParticipant = {
      uid: profile.uid,
      displayName: profile.displayName,
      instagramId: profile.instagramId,
      photoURL: profile.photoURL,
      age: profile.age,
      gender: profile.appearance.gender,
      relationshipStatus: profile.relationshipStatus,
      appearance: profile.appearance,
      joinedAt: Date.now(),
      isOnline: true,
      isNpc: false,
    };
    const existing = store.mingleEvent.joinedAccounts || [];
    const nextJoined = existing.some((p) => p.uid === profile.uid)
      ? existing
      : [...existing, selfPart];
    store.patchMingleEvent({ isJoined: true, joinedAccounts: nextJoined });
    store.pushToast('Joined Single-to-Mingle (FREE)!', 'Your account & DP are live on screen.', 'rose');
  }

  leaveMingle(): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:leave', {});
      return;
    }
    const store = useGameStore.getState();
    const uid = store.profile?.uid;
    const nextJoined = (store.mingleEvent.joinedAccounts || []).filter((p) => p.uid !== uid);
    store.patchMingleEvent({ isJoined: false, joinedAccounts: nextJoined });
  }

  autoSelectMingleCouple(): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:autoSelect', {});
      return;
    }
    this.triggerMingleDemo('match');
  }

  triggerMingleDemo(mode: 'alarm' | 'match'): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:triggerDemo', { mode });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    if (!profile) return;
    const loc = MINGLE_MEETUP_LOCATIONS[0];
    if (mode === 'alarm') {
      const nextAt = Date.now() + 5 * 60 * 1000;
      store.patchMingleEvent({
        alarmActive: true,
        nextEventAtMs: nextAt,
        locationName: loc.name,
        locationPos: loc.pos,
      });
      store.setWaypointTarget({ x: loc.pos.x, z: loc.pos.z, label: `Mingle: ${loc.name}` });
      playSfx('alarm');
      store.pushToast('5-Min Single-to-Mingle Alarm!', `Meetup at ${loc.name}`, 'rose');
    } else {
      const selfPart: MingleParticipant = {
        uid: profile.uid,
        displayName: profile.displayName,
        instagramId: profile.instagramId,
        photoURL: profile.photoURL,
        age: profile.age,
        gender: profile.appearance.gender,
        relationshipStatus: profile.relationshipStatus,
        appearance: profile.appearance,
        joinedAt: Date.now(),
        isOnline: true,
        isNpc: false,
      };
      const remoteList: MingleParticipant[] = Object.values(store.remotePlayers).map((rp) => ({
        uid: rp.uid,
        displayName: rp.displayName,
        instagramId: rp.instagramId,
        photoURL: rp.photoURL,
        age: rp.age || 22,
        gender: rp.appearance.gender,
        relationshipStatus: rp.relationshipStatus || 'single',
        appearance: rp.appearance,
        joinedAt: Date.now(),
        isOnline: true,
        isNpc: false,
      }));
      const allJoined = [selfPart, ...remoteList];
      const matchId = `match_${Date.now()}`;

      let memberA = selfPart;
      let memberB: MingleParticipant;
      if (allJoined.length >= 2) {
        const shuffled = [...allJoined].sort(() => Math.random() - 0.5);
        memberA = shuffled[0];
        memberB = shuffled[1];
      } else {
        const wantedGender = profile.appearance.gender === 'male' ? 'female' : 'male';
        const candidates = VALLEY_SINGLES.filter((n) => n.gender === wantedGender);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || VALLEY_SINGLES[0];
        memberB = {
          uid: pick.uid,
          displayName: pick.name,
          instagramId: pick.instagram,
          photoURL: '',
          age: pick.age,
          gender: pick.gender,
          relationshipStatus: 'single',
          appearance: {
            gender: pick.gender,
            skinTone: pick.skinTone,
            hairStyle: pick.hairStyle,
            hairColor: pick.hairColor,
            shirtStyle: pick.shirtStyle,
            shirtColor: pick.shirtColor,
            pantsColor: pick.gender === 'female' ? '#fda4af' : '#1e293b',
            shoeColor: '#f8fafc',
            accessory: 'none',
          },
          joinedAt: Date.now(),
          isOnline: true,
          isNpc: true,
        };
      }

      const partner = memberA.uid === profile.uid ? memberB : memberA;
      store.setMingleEvent({
        nextEventAtMs: Date.now() + 3600000,
        alarmActive: false,
        locationName: loc.name,
        locationPos: loc.pos,
        isJoined: true,
        joinedAccounts: allJoined,
        selectedPair: {
          matchId,
          memberA,
          memberB,
          selectedAt: Date.now(),
          locationName: loc.name,
          locationPos: loc.pos,
          status: 'proposed',
          memberAAccepted: false,
          memberBAccepted: Boolean(memberB.isNpc),
        },
        activeMatch: {
          matchId,
          partnerUid: partner.uid,
          partnerName: partner.displayName,
          partnerInstagram: partner.instagramId,
          partnerPhotoURL: partner.photoURL,
          partnerAppearance: partner.appearance,
          partnerAge: partner.age,
          partnerGender: partner.gender,
          isNpcPartner: Boolean(partner.isNpc),
          myAccepted: false,
          partnerAccepted: Boolean(partner.isNpc),
          status: 'proposed',
        },
      });
      playSfx('alarm');
      store.pushToast(
        '2 Accounts Auto-Selected (FREE)!',
        `${memberA.displayName} ♥ ${memberB.displayName} — DPs revealed!`,
        'rose',
      );
    }
  }

  respondMingle(accept: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:respond', { accept });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const match = store.mingleEvent.activeMatch;
    if (!profile || !match) return;
    if (!accept) {
      store.patchMingleEvent({ activeMatch: null, selectedPair: null });
      store.pushToast('Match Declined', 'You remain Single for the next free round.', 'amber');
      return;
    }
    const nextXp = profile.xp + 200;
    const prevPair = store.mingleEvent.selectedPair;
    store.patchMingleEvent({
      activeMatch: { ...match, myAccepted: true, partnerAccepted: true, status: 'married' },
      selectedPair: prevPair
        ? { ...prevPair, status: 'married', memberAAccepted: true, memberBAccepted: true }
        : null,
    });
    playSfx('wedding');
    this.applyLocalTransaction(
      {
        xp: nextXp,
        level: levelFromXp(nextXp),
        relationshipStatus: 'married',
        partnerUid: match.partnerUid,
        partnerName: match.partnerName,
        partnerInstagram: match.partnerInstagram,
      },
      undefined,
      {
        title: `Married to ${match.partnerName}!`,
        detail: '100% FREE Royal Wedding & Free Honeymoon Unlocked!',
        tone: 'rose',
      },
    );
    store.requestTeleport({ x: -110, y: 0, z: -14 });
  }

  serveWeddingFeast(): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:feast', {});
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const match = store.mingleEvent.activeMatch;
    if (!profile || !match) return;
    const prevPair = store.mingleEvent.selectedPair;
    store.patchMingleEvent({
      activeMatch: { ...match, feastServed: true },
      selectedPair: prevPair ? { ...prevPair, feastServed: true } : null,
    });
    const nextXp = profile.xp + 120;
    this.applyLocalTransaction(
      { xp: nextXp, level: levelFromXp(nextXp) },
      undefined,
      {
        title: 'Free Grand Wedding Feast Served!',
        detail: 'Complimentary Kerala Sadhya, Biryani, Payasam & Cake (+100 HP · +120 XP)',
        tone: 'amber',
      },
      100,
    );
  }

  startHoneymoon(): void {
    if (this.socket?.connected) {
      this.socket.emit('mingle:honeymoon', {});
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const match = store.mingleEvent.activeMatch;
    if (!profile || !match) return;
    const prevPair = store.mingleEvent.selectedPair;
    store.patchMingleEvent({
      activeMatch: { ...match, status: 'honeymoon' },
      selectedPair: prevPair ? { ...prevPair, status: 'honeymoon' } : null,
    });
    store.setTimeOfDayMode('golden');
    store.requestTeleport({ x: -78, y: 0, z: 112 });
    const nextXp = profile.xp + 150;
    playSfx('wedding');
    this.applyLocalTransaction(
      { xp: nextXp, level: levelFromXp(nextXp) },
      undefined,
      {
        title: 'Free Lakeside Honeymoon Resort!',
        detail: `Complimentary Golden Sunset Retreat with ${match.partnerName} ♥ (0 GC)`,
        tone: 'rose',
      },
      100,
    );
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
    if (this.socket?.connected) {
      this.socket.emit('property:buy', { propertyId });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const prop = PROPERTIES.find((p) => p.id === propertyId);
    if (!profile || !prop) return;
    if (profile.ownedProperties.includes(propertyId)) return;
    const cost = store.isAdmin ? 0 : prop.price;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC for ${prop.name}.`, 'rose');
      return;
    }
    const bal = profile.greenCoins - cost;
    const ownership: WorldPropertyOwnership = {
      propertyId,
      ownerUid: profile.uid,
      ownerName: profile.displayName,
      interiorTheme: 'modern',
      gardenStyle: 'flowers',
    };
    store.upsertWorldProperty(ownership);
    void saveWorldPropertyClaim(propertyId, profile.uid, profile.displayName).catch(() => {});
    this.applyLocalTransaction(
      { greenCoins: bal, ownedProperties: [...profile.ownedProperties, propertyId] },
      cost > 0 ? { type: 'spend', amount: cost, reason: `Purchased ${prop.name}`, balanceAfter: bal } : undefined,
      { title: `Purchased ${prop.name}`, detail: 'Welcome home!', tone: 'emerald' },
    );
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
    if (this.socket?.connected) {
      this.socket.emit('business:buy', { businessId });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const biz = BUSINESSES.find((b) => b.id === businessId);
    if (!profile || !biz) return;
    if (profile.ownedBusinesses.includes(businessId)) return;
    const cost = store.isAdmin ? 0 : biz.price;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC for ${biz.name}.`, 'rose');
      return;
    }
    const bal = profile.greenCoins - cost;
    store.setBusinessCooldown(businessId, Date.now() + biz.cooldownSec * 1000);
    this.applyLocalTransaction(
      { greenCoins: bal, ownedBusinesses: [...profile.ownedBusinesses, businessId] },
      cost > 0 ? { type: 'spend', amount: cost, reason: `Acquired ${biz.name}`, balanceAfter: bal } : undefined,
      { title: `Business Acquired: ${biz.name}`, detail: `Earns ${biz.payout} GC every ${biz.cooldownSec}s`, tone: 'amber' },
    );
  }

  collectBusiness(businessId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('business:collect', { businessId });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const biz = BUSINESSES.find((b) => b.id === businessId);
    if (!profile || !biz) return;
    const readyAt = store.businessCooldowns[businessId] || 0;
    if (Date.now() < readyAt) return;
    store.setBusinessCooldown(businessId, Date.now() + biz.cooldownSec * 1000);
    const bal = profile.greenCoins + biz.payout;
    const nextXp = profile.xp + 35;
    this.applyLocalTransaction(
      { greenCoins: bal, xp: nextXp, level: levelFromXp(nextXp) },
      { type: 'earn', amount: biz.payout, reason: `${biz.name} revenue`, balanceAfter: bal },
      { title: `Collected ${biz.payout} GC`, detail: biz.name, tone: 'emerald' },
    );
  }

  buyShopItem(itemId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('shop:buy', { itemId });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!profile || !item) return;
    if (profile.inventory.length >= 30) {
      store.pushToast('Inventory Full', 'Max 30 items.', 'rose');
      return;
    }
    const cost = store.isAdmin ? 0 : item.price;
    if (cost > 0 && profile.greenCoins < cost) {
      store.pushToast('Insufficient Coins', `Need ${cost} GC for ${item.name}.`, 'rose');
      return;
    }
    const bal = profile.greenCoins - cost;
    this.applyLocalTransaction(
      { greenCoins: bal, inventory: [...profile.inventory, item.id] },
      cost > 0 ? { type: 'spend', amount: cost, reason: `Bought ${item.name}`, balanceAfter: bal } : undefined,
      { title: `Purchased ${item.name}`, detail: 'Added to your Inventory', tone: 'sky' },
    );
  }

  useInventoryItem(itemId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('inventory:use', { itemId });
      return;
    }
    const store = useGameStore.getState();
    const profile = store.profile;
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!profile || !item || !item.healthRestore) return;
    const idx = profile.inventory.indexOf(itemId);
    if (idx === -1) return;
    const nextInv = [...profile.inventory];
    nextInv.splice(idx, 1);
    this.applyLocalTransaction(
      { inventory: nextInv },
      undefined,
      { title: `Used ${item.name}`, detail: `+${item.healthRestore} HP restored`, tone: 'emerald' },
      item.healthRestore,
    );
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

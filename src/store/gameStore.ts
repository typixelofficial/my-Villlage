import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type {
  ActiveWorkShift,
  ChatMessage,
  CustomHomeDef,
  CustomShopDef,
  EmoteType,
  FriendRequest,
  GameToast,
  HeldItemType,
  InteractablePrompt,
  MingleEventState,
  NetworkPlayer,
  PalaceVillaDef,
  PhoneCallState,
  PlayerProfile,
  PublicAdDef,
  PublicBusState,
  SportsBallState,
  TimeOfDayMode,
  TypixelUpdateAlert,
  VehicleState,
  WalletTransaction,
  WeatherMode,
  WorldPropertyOwnership,
} from '../shared/types.ts';
import {
  FOOTBALL_PITCH_CENTER,
  INITIAL_VEHICLES,
  MINGLE_MEETUP_LOCATIONS,
  MISSIONS,
  PALACE_VILLAS,
  VOLLEYBALL_COURT_CENTER,
  WORLD_HALF_SIZE,
} from '../shared/worldData.ts';

export type ScreenMode = 'loading' | 'login' | 'character' | 'world';
export type ActivePanel =
  | null
  | 'chat'
  | 'missions'
  | 'works'
  | 'properties'
  | 'businesses'
  | 'shops'
  | 'player_shop'
  | 'building'
  | 'mingle'
  | 'daily_reward'
  | 'vehicles'
  | 'friends'
  | 'inventory'
  | 'wallet'
  | 'settings'
  | 'admin'
  | 'vehicle_prompt'
  | 'pause'
  | 'npc'
  | 'phone'
  | 'search'
  | 'ads'
  | 'transit'
  | 'game_center'
  | 'villa';

export interface VoicePeerState {
  uid: string;
  muted: boolean;
  speaking: boolean;
  connected: boolean;
}

interface ActiveNpcDialog {
  name: string;
  role: string;
  dialogue: string;
  canHeal?: boolean;
}

export interface VillaAccessFlags {
  canVisitOutside: boolean;
  canEnterInside: boolean;
}

const initialVehiclesMap: Record<string, VehicleState> = {};
for (const v of INITIAL_VEHICLES) {
  initialVehiclesMap[v.id] = { ...v };
}

const initialVillasMap: Record<string, PalaceVillaDef> = {};
for (const v of PALACE_VILLAS) {
  initialVillasMap[v.villaId] = { ...v };
}

const defaultMingle: MingleEventState = {
  nextEventAtMs: Date.now() + 5 * 60 * 1000,
  maxRoundDurationMs: 5 * 60 * 1000,
  alarmActive: false,
  locationName: MINGLE_MEETUP_LOCATIONS[0].name,
  locationPos: MINGLE_MEETUP_LOCATIONS[0].pos,
  activeMatch: null,
};

const defaultSportsBalls: Record<'football' | 'volleyball', SportsBallState> = {
  football: {
    id: 'football',
    x: FOOTBALL_PITCH_CENTER.x,
    y: 0.45,
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
    y: 0.45,
    z: VOLLEYBALL_COURT_CENTER.z,
    vx: 0,
    vy: 0,
    vz: 0,
    scoreA: 0,
    scoreB: 0,
  },
};

interface GameState {
  // Auth & Navigation
  authReady: boolean;
  firebaseUser: User | null;
  screen: ScreenMode;
  isEditingExistingCharacter: boolean;
  isAdmin: boolean;
  adminBearerToken: string | null; // Strictly in-memory (NEVER localStorage)
  pendingInstagramDraft: string;

  // Player Profile & Local Live State
  profile: PlayerProfile | null;
  health: number;
  lowHealthAlertDismissed: boolean;
  localHeldItem: HeldItemType;
  localHeldItemUntil: number;
  activeVehicleId: string | null;
  pendingVehiclePromptId: string | null;
  activeBuildingId: string | null;
  activeCustomShopId: string | null;
  activeVillaId: string | null;
  unlockedShopIds: string[];
  showWorldMapModal: boolean;
  localSpeedKmh: number;
  localAltitude: number;
  currentDistrictName: string;
  localPos: { x: number; y: number; z: number; rotY: number };

  // Multiplayer & World State
  socketConnected: boolean;
  sessionReplacedMessage: string | null;
  villageHalfSize: number;
  remotePlayers: Record<string, NetworkPlayer>;
  vehicles: Record<string, VehicleState>;
  publicBus: PublicBusState | null;
  worldProperties: Record<string, WorldPropertyOwnership>;
  customHomes: Record<string, CustomHomeDef>;
  customShops: Record<string, CustomShopDef>;
  publicAds: PublicAdDef[];
  palaceVillas: Record<string, PalaceVillaDef>;
  villaAccess: Record<string, VillaAccessFlags>;
  typixelUpdates: TypixelUpdateAlert[];
  unreadUpdatesCount: number;
  phoneCall: PhoneCallState | null;
  sportsBalls: Record<'football' | 'volleyball', SportsBallState>;
  mingleEvent: MingleEventState;
  chatMessages: ChatMessage[];
  chatChannel: 'global' | 'proximity' | 'direct';
  directChatTargetUid: string | null;
  unreadChatCount: number;
  friendRequests: FriendRequest[];

  // Live Multiplayer Voice Chat (WebRTC)
  voiceJoined: boolean;
  voiceMuted: boolean;
  voiceMode: 'global' | 'proximity';
  voiceError: string | null;
  localSpeaking: boolean;
  voicePeers: Record<string, VoicePeerState>;

  // Economy, Works, Rewards & Missions
  activeMissionId: string | null;
  activeWorkShift: ActiveWorkShift | null;
  waypointTarget: { x: number; z: number; label: string } | null;
  transactions: WalletTransaction[];
  businessCooldowns: Record<string, number>;
  workCooldowns: Record<string, number>;
  dailyRewardReadyAt: number;

  // Interactive World & UI
  nearbyPrompt: InteractablePrompt | null;
  activePanel: ActivePanel;
  activeNpcDialog: ActiveNpcDialog | null;
  hudCollapsed: boolean;
  toasts: GameToast[];
  pendingEmote: EmoteType | null;
  pendingTeleport: { x: number; y: number; z: number } | null;

  // Settings & Performance
  timeOfDayMode: TimeOfDayMode;
  weatherMode: WeatherMode;
  audioEnabled: boolean;
  showMobileControls: boolean;
  fps: number;

  // Actions
  setAuthUser: (user: User | null, ready: boolean) => void;
  setScreen: (screen: ScreenMode, editingExisting?: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setAdminBearerToken: (token: string | null) => void;
  setPendingInstagramDraft: (handle: string) => void;
  setProfile: (profile: PlayerProfile | null) => void;
  patchProfile: (partial: Partial<PlayerProfile>) => void;
  setHealth: (hp: number) => void;
  setLowHealthAlertDismissed: (dismissed: boolean) => void;
  setLocalHeldItem: (item: HeldItemType, untilMs?: number) => void;
  setActiveVehicleId: (id: string | null) => void;
  openVehiclePrompt: (vehicleId: string) => void;
  openBuildingPanel: (buildingId: string) => void;
  openPlayerShopPanel: (shopId: string) => void;
  openVillaPanel: (villaId: string) => void;
  markShopUnlocked: (shopId: string) => void;
  setShowWorldMapModal: (open: boolean) => void;
  setTelemetry: (
    speedKmh: number,
    altitude: number,
    districtName: string,
    pos: { x: number; y: number; z: number; rotY: number },
  ) => void;
  setSocketConnected: (connected: boolean) => void;
  setSessionReplacedMessage: (msg: string | null) => void;
  setVillageHalfSize: (halfSize: number) => void;
  setRemotePlayers: (players: Record<string, NetworkPlayer>) => void;
  upsertRemotePlayer: (player: NetworkPlayer) => void;
  removeRemotePlayer: (uid: string) => void;
  setVehicles: (vehicles: VehicleState[]) => void;
  updateVehicle: (vehicle: VehicleState) => void;
  setPublicBus: (bus: PublicBusState | null) => void;
  setWorldProperties: (props: Record<string, WorldPropertyOwnership>) => void;
  upsertWorldProperty: (prop: WorldPropertyOwnership) => void;
  setCustomHomes: (homes: Record<string, CustomHomeDef>) => void;
  upsertCustomHome: (home: CustomHomeDef) => void;
  removeCustomHome: (homeId: string) => void;
  setCustomShops: (shops: Record<string, CustomShopDef>) => void;
  upsertCustomShop: (shop: CustomShopDef) => void;
  removeCustomShop: (shopId: string) => void;
  setPublicAds: (ads: PublicAdDef[]) => void;
  prependPublicAd: (ad: PublicAdDef) => void;
  setPalaceVillas: (villas: PalaceVillaDef[]) => void;
  upsertPalaceVilla: (villa: PalaceVillaDef) => void;
  setVillaAccess: (villaId: string, flags: Partial<VillaAccessFlags>) => void;
  setTypixelUpdates: (updates: TypixelUpdateAlert[]) => void;
  prependTypixelUpdate: (update: TypixelUpdateAlert) => void;
  clearUnreadUpdates: () => void;
  setPhoneCall: (call: PhoneCallState | null) => void;
  setSportsBalls: (balls: SportsBallState[]) => void;
  setMingleEvent: (ev: MingleEventState) => void;
  patchMingleEvent: (partial: Partial<MingleEventState>) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatChannel: (ch: 'global' | 'proximity' | 'direct') => void;
  setDirectChatTargetUid: (uid: string | null) => void;
  clearUnreadChat: () => void;
  addFriendRequest: (req: FriendRequest) => void;
  removeFriendRequest: (fromUid: string) => void;

  // Voice Actions
  setVoiceJoined: (joined: boolean) => void;
  setVoiceMuted: (muted: boolean) => void;
  setVoiceMode: (mode: 'global' | 'proximity') => void;
  setVoiceError: (err: string | null) => void;
  setLocalSpeaking: (speaking: boolean) => void;
  upsertVoicePeer: (uid: string, patch: Partial<VoicePeerState>) => void;
  removeVoicePeer: (uid: string) => void;
  resetVoiceState: () => void;

  setActiveMissionId: (id: string | null) => void;
  setActiveWorkShift: (shift: ActiveWorkShift | null) => void;
  setWaypointTarget: (wp: { x: number; z: number; label: string } | null) => void;
  setTransactions: (txs: WalletTransaction[]) => void;
  prependTransaction: (tx: WalletTransaction) => void;
  setBusinessCooldown: (bizId: string, readyAtMs: number) => void;
  setWorkCooldown: (jobId: string, readyAtMs: number) => void;
  setDailyRewardReadyAt: (ts: number) => void;
  setNearbyPrompt: (prompt: InteractablePrompt | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  openNpcDialog: (dialog: ActiveNpcDialog) => void;
  toggleHudCollapsed: () => void;
  pushToast: (title: string, detail?: string, tone?: GameToast['tone']) => void;
  dismissToast: (id: string) => void;
  triggerEmote: (emote: EmoteType | null) => void;
  requestTeleport: (pos: { x: number; y: number; z: number } | null) => void;
  setTimeOfDayMode: (mode: TimeOfDayMode) => void;
  setWeatherMode: (mode: WeatherMode) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setShowMobileControls: (show: boolean) => void;
  setFps: (fps: number) => void;
  resetForLogout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  authReady: false,
  firebaseUser: null,
  screen: 'loading',
  isEditingExistingCharacter: false,
  isAdmin: false,
  adminBearerToken: null,
  pendingInstagramDraft: '',

  profile: null,
  health: 100,
  lowHealthAlertDismissed: false,
  localHeldItem: 'none',
  localHeldItemUntil: 0,
  activeVehicleId: null,
  pendingVehiclePromptId: null,
  activeBuildingId: null,
  activeCustomShopId: null,
  activeVillaId: null,
  unlockedShopIds: [],
  showWorldMapModal: false,
  localSpeedKmh: 0,
  localAltitude: 0,
  currentDistrictName: 'Central Fountain Square',
  localPos: { x: 0, y: 0, z: 16, rotY: 0 },

  socketConnected: false,
  sessionReplacedMessage: null,
  villageHalfSize: WORLD_HALF_SIZE,
  remotePlayers: {},
  vehicles: initialVehiclesMap,
  publicBus: null,
  worldProperties: {},
  customHomes: {},
  customShops: {},
  publicAds: [],
  palaceVillas: initialVillasMap,
  villaAccess: {},
  typixelUpdates: [],
  unreadUpdatesCount: 0,
  phoneCall: null,
  sportsBalls: defaultSportsBalls,
  mingleEvent: defaultMingle,
  chatMessages: [],
  chatChannel: 'global',
  directChatTargetUid: null,
  unreadChatCount: 0,
  friendRequests: [],

  voiceJoined: false,
  voiceMuted: false,
  voiceMode: 'global',
  voiceError: null,
  localSpeaking: false,
  voicePeers: {},

  activeMissionId: MISSIONS[0].id,
  activeWorkShift: null,
  waypointTarget: null,
  transactions: [],
  businessCooldowns: {},
  workCooldowns: {},
  dailyRewardReadyAt: 0,

  nearbyPrompt: null,
  activePanel: null,
  activeNpcDialog: null,
  hudCollapsed: false,
  toasts: [],
  pendingEmote: null,
  pendingTeleport: null,

  timeOfDayMode: 'cycle',
  weatherMode: 'clear',
  audioEnabled: true,
  showMobileControls: typeof window !== 'undefined' && 'ontouchstart' in window,
  fps: 60,

  setAuthUser: (firebaseUser, authReady) => set({ firebaseUser, authReady }),
  setScreen: (screen, editingExisting = false) =>
    set({ screen, isEditingExistingCharacter: editingExisting }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setAdminBearerToken: (adminBearerToken) => set({ adminBearerToken }),
  setPendingInstagramDraft: (pendingInstagramDraft) => set({ pendingInstagramDraft }),
  setProfile: (profile) =>
    set((s) => {
      if (!profile) return { profile: null };
      const nextMission =
        MISSIONS.find((m) => !profile.completedMissions.includes(m.id))?.id ?? null;
      return {
        profile,
        activeMissionId:
          s.activeMissionId && !profile.completedMissions.includes(s.activeMissionId)
            ? s.activeMissionId
            : nextMission,
      };
    }),
  patchProfile: (partial) =>
    set((s) => (s.profile ? { profile: { ...s.profile, ...partial } } : s)),
  setHealth: (hp) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(100, Math.round(hp)));
      return {
        health: clamped,
        lowHealthAlertDismissed: clamped >= 50 ? false : s.lowHealthAlertDismissed,
      };
    }),
  setLowHealthAlertDismissed: (lowHealthAlertDismissed) => set({ lowHealthAlertDismissed }),
  setLocalHeldItem: (localHeldItem, untilMs = Date.now() + 9000) =>
    set({ localHeldItem, localHeldItemUntil: localHeldItem === 'none' ? 0 : untilMs }),
  setActiveVehicleId: (activeVehicleId) => set({ activeVehicleId }),
  openVehiclePrompt: (vehicleId) =>
    set({ pendingVehiclePromptId: vehicleId, activePanel: 'vehicle_prompt' }),
  openBuildingPanel: (buildingId) =>
    set({ activeBuildingId: buildingId, activePanel: 'building' }),
  openPlayerShopPanel: (shopId) =>
    set({ activeCustomShopId: shopId, activePanel: 'player_shop' }),
  openVillaPanel: (villaId) =>
    set({ activeVillaId: villaId, activePanel: 'villa' }),
  markShopUnlocked: (shopId) =>
    set((s) => ({
      unlockedShopIds: s.unlockedShopIds.includes(shopId)
        ? s.unlockedShopIds
        : [...s.unlockedShopIds, shopId],
    })),
  setShowWorldMapModal: (showWorldMapModal) => set({ showWorldMapModal }),
  setTelemetry: (localSpeedKmh, localAltitude, currentDistrictName, localPos) =>
    set({ localSpeedKmh, localAltitude, currentDistrictName, localPos }),
  setSocketConnected: (socketConnected) => set({ socketConnected }),
  setSessionReplacedMessage: (sessionReplacedMessage) => set({ sessionReplacedMessage }),
  setVillageHalfSize: (villageHalfSize) => set({ villageHalfSize }),
  setRemotePlayers: (remotePlayers) => set({ remotePlayers }),
  upsertRemotePlayer: (player) =>
    set((s) => ({
      remotePlayers: { ...s.remotePlayers, [player.uid]: player },
    })),
  removeRemotePlayer: (uid) =>
    set((s) => {
      const next = { ...s.remotePlayers };
      delete next[uid];
      const nextVoice = { ...s.voicePeers };
      delete nextVoice[uid];
      return {
        remotePlayers: next,
        voicePeers: nextVoice,
        directChatTargetUid: s.directChatTargetUid === uid ? null : s.directChatTargetUid,
      };
    }),
  setVehicles: (vehiclesList) =>
    set(() => {
      const map: Record<string, VehicleState> = {};
      for (const v of vehiclesList) map[v.id] = v;
      return { vehicles: map };
    }),
  updateVehicle: (vehicle) =>
    set((s) => ({
      vehicles: { ...s.vehicles, [vehicle.id]: vehicle },
    })),
  setPublicBus: (publicBus) => set({ publicBus }),
  setWorldProperties: (worldProperties) => set({ worldProperties }),
  upsertWorldProperty: (prop) =>
    set((s) => ({
      worldProperties: { ...s.worldProperties, [prop.propertyId]: prop },
    })),
  setCustomHomes: (customHomes) => set({ customHomes }),
  upsertCustomHome: (home) =>
    set((s) => ({
      customHomes: { ...s.customHomes, [home.homeId]: home },
    })),
  removeCustomHome: (homeId) =>
    set((s) => {
      const next = { ...s.customHomes };
      delete next[homeId];
      return { customHomes: next };
    }),
  setCustomShops: (customShops) => set({ customShops }),
  upsertCustomShop: (shop) =>
    set((s) => ({
      customShops: { ...s.customShops, [shop.shopId]: shop },
    })),
  removeCustomShop: (shopId) =>
    set((s) => {
      const next = { ...s.customShops };
      delete next[shopId];
      return { customShops: next };
    }),
  setPublicAds: (publicAds) => set({ publicAds }),
  prependPublicAd: (ad) =>
    set((s) => {
      if (s.publicAds.some((a) => a.adId === ad.adId)) return s;
      return { publicAds: [ad, ...s.publicAds.slice(0, 29)] };
    }),
  setPalaceVillas: (villasList) =>
    set(() => {
      const map: Record<string, PalaceVillaDef> = {};
      for (const v of villasList) map[v.villaId] = v;
      return { palaceVillas: map };
    }),
  upsertPalaceVilla: (villa) =>
    set((s) => ({
      palaceVillas: { ...s.palaceVillas, [villa.villaId]: villa },
    })),
  setVillaAccess: (villaId, flags) =>
    set((s) => {
      const prev = s.villaAccess[villaId] || { canVisitOutside: false, canEnterInside: false };
      return {
        villaAccess: {
          ...s.villaAccess,
          [villaId]: { ...prev, ...flags },
        },
      };
    }),
  setTypixelUpdates: (typixelUpdates) => set({ typixelUpdates }),
  prependTypixelUpdate: (update) =>
    set((s) => {
      if (s.typixelUpdates.some((u) => u.id === update.id)) return s;
      return {
        typixelUpdates: [update, ...s.typixelUpdates.slice(0, 29)],
        unreadUpdatesCount: s.activePanel === 'phone' ? 0 : Math.min(99, s.unreadUpdatesCount + 1),
      };
    }),
  clearUnreadUpdates: () => set({ unreadUpdatesCount: 0 }),
  setPhoneCall: (phoneCall) => set({ phoneCall }),
  setSportsBalls: (ballsList) =>
    set((s) => {
      const next = { ...s.sportsBalls };
      for (const b of ballsList) next[b.id] = b;
      return { sportsBalls: next };
    }),
  setMingleEvent: (mingleEvent) => set({ mingleEvent }),
  patchMingleEvent: (partial) =>
    set((s) => ({ mingleEvent: { ...s.mingleEvent, ...partial } })),
  addChatMessage: (msg) =>
    set((s) => {
      if (s.chatMessages.some((m) => m.id === msg.id)) return s;
      const shouldCountUnread =
        s.activePanel !== 'chat' &&
        msg.channel !== 'system' &&
        msg.uid !== s.firebaseUser?.uid;
      return {
        chatMessages: [...s.chatMessages.slice(-99), msg],
        unreadChatCount: shouldCountUnread
          ? Math.min(99, s.unreadChatCount + 1)
          : s.unreadChatCount,
      };
    }),
  setChatChannel: (chatChannel) => set({ chatChannel }),
  setDirectChatTargetUid: (directChatTargetUid) =>
    set((s) => ({
      directChatTargetUid,
      chatChannel: directChatTargetUid
        ? 'direct'
        : s.chatChannel === 'direct'
          ? 'global'
          : s.chatChannel,
    })),
  clearUnreadChat: () => set({ unreadChatCount: 0 }),
  addFriendRequest: (req) =>
    set((s) => {
      if (s.friendRequests.some((r) => r.fromUid === req.fromUid)) return s;
      return { friendRequests: [...s.friendRequests, req] };
    }),
  removeFriendRequest: (fromUid) =>
    set((s) => ({
      friendRequests: s.friendRequests.filter((r) => r.fromUid !== fromUid),
    })),

  setVoiceJoined: (voiceJoined) => set({ voiceJoined }),
  setVoiceMuted: (voiceMuted) => set({ voiceMuted }),
  setVoiceMode: (voiceMode) => set({ voiceMode }),
  setVoiceError: (voiceError) => set({ voiceError }),
  setLocalSpeaking: (localSpeaking) => set({ localSpeaking }),
  upsertVoicePeer: (uid, patch) =>
    set((s) => {
      const prev = s.voicePeers[uid] || {
        uid,
        muted: false,
        speaking: false,
        connected: false,
      };
      return {
        voicePeers: {
          ...s.voicePeers,
          [uid]: { ...prev, ...patch, uid },
        },
      };
    }),
  removeVoicePeer: (uid) =>
    set((s) => {
      const next = { ...s.voicePeers };
      delete next[uid];
      return { voicePeers: next };
    }),
  resetVoiceState: () =>
    set({
      voiceJoined: false,
      voiceMuted: false,
      voiceError: null,
      localSpeaking: false,
      voicePeers: {},
    }),

  setActiveMissionId: (activeMissionId) => set({ activeMissionId }),
  setActiveWorkShift: (activeWorkShift) => set({ activeWorkShift }),
  setWaypointTarget: (waypointTarget) => set({ waypointTarget }),
  setTransactions: (transactions) => set({ transactions }),
  prependTransaction: (tx) =>
    set((s) => ({ transactions: [tx, ...s.transactions.slice(0, 29)] })),
  setBusinessCooldown: (bizId, readyAtMs) =>
    set((s) => ({
      businessCooldowns: { ...s.businessCooldowns, [bizId]: readyAtMs },
    })),
  setWorkCooldown: (jobId, readyAtMs) =>
    set((s) => ({
      workCooldowns: { ...s.workCooldowns, [jobId]: readyAtMs },
    })),
  setDailyRewardReadyAt: (dailyRewardReadyAt) => set({ dailyRewardReadyAt }),
  setNearbyPrompt: (nearbyPrompt) => set({ nearbyPrompt }),
  setActivePanel: (activePanel) =>
    set((s) => ({
      activePanel,
      unreadChatCount: activePanel === 'chat' ? 0 : s.unreadChatCount,
      unreadUpdatesCount: activePanel === 'phone' ? 0 : s.unreadUpdatesCount,
    })),
  openNpcDialog: (activeNpcDialog) => set({ activeNpcDialog, activePanel: 'npc' }),
  toggleHudCollapsed: () => set((s) => ({ hudCollapsed: !s.hudCollapsed })),
  pushToast: (title, detail, tone = 'emerald') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      toasts: [...s.toasts.slice(-3), { id, title, detail, tone, createdAt: Date.now() }],
    }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  triggerEmote: (pendingEmote) => set({ pendingEmote }),
  requestTeleport: (pendingTeleport) => set({ pendingTeleport }),
  setTimeOfDayMode: (timeOfDayMode) => set({ timeOfDayMode }),
  setWeatherMode: (weatherMode) => set({ weatherMode }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setShowMobileControls: (showMobileControls) => set({ showMobileControls }),
  setFps: (fps) => set({ fps }),
  resetForLogout: () =>
    set({
      firebaseUser: null,
      profile: null,
      screen: 'login',
      isAdmin: false,
      adminBearerToken: null,
      health: 100,
      lowHealthAlertDismissed: false,
      localHeldItem: 'none',
      localHeldItemUntil: 0,
      activeVehicleId: null,
      pendingVehiclePromptId: null,
      activeBuildingId: null,
      activeCustomShopId: null,
      activeVillaId: null,
      unlockedShopIds: [],
      showWorldMapModal: false,
      activeWorkShift: null,
      waypointTarget: null,
      remotePlayers: {},
      customShops: {},
      publicBus: null,
      phoneCall: null,
      villaAccess: {},
      mingleEvent: defaultMingle,
      chatMessages: [],
      directChatTargetUid: null,
      unreadChatCount: 0,
      unreadUpdatesCount: 0,
      friendRequests: [],
      voiceJoined: false,
      voiceMuted: false,
      voiceError: null,
      localSpeaking: false,
      voicePeers: {},
      activePanel: null,
      nearbyPrompt: null,
      socketConnected: false,
      sessionReplacedMessage: null,
    }),
}));

import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type {
  ActiveWorkShift,
  ChatMessage,
  CustomHomeDef,
  EmoteType,
  FriendRequest,
  GameToast,
  InteractablePrompt,
  NetworkPlayer,
  PlayerProfile,
  TimeOfDayMode,
  VehicleState,
  WalletTransaction,
  WeatherMode,
  WorldPropertyOwnership,
} from '../shared/types.ts';
import { INITIAL_VEHICLES, MISSIONS } from '../shared/worldData.ts';

export type ScreenMode = 'loading' | 'login' | 'character' | 'world';
export type ActivePanel =
  | null
  | 'chat'
  | 'missions'
  | 'works'
  | 'properties'
  | 'businesses'
  | 'vehicles'
  | 'friends'
  | 'inventory'
  | 'wallet'
  | 'settings'
  | 'admin'
  | 'vehicle_prompt'
  | 'pause'
  | 'npc';

interface ActiveNpcDialog {
  name: string;
  role: string;
  dialogue: string;
  canHeal?: boolean;
}

interface GameState {
  // Auth & Navigation
  authReady: boolean;
  firebaseUser: User | null;
  screen: ScreenMode;
  isEditingExistingCharacter: boolean;
  isAdmin: boolean;
  adminToken: string | null;
  pendingInstagramDraft: string;

  // Player Profile & Local Live State
  profile: PlayerProfile | null;
  health: number;
  activeVehicleId: string | null;
  pendingVehiclePromptId: string | null;
  localSpeedKmh: number;
  localAltitude: number;
  currentDistrictName: string;
  localPos: { x: number; y: number; z: number; rotY: number };

  // Multiplayer & World State
  socketConnected: boolean;
  sessionReplacedMessage: string | null;
  remotePlayers: Record<string, NetworkPlayer>;
  vehicles: Record<string, VehicleState>;
  worldProperties: Record<string, WorldPropertyOwnership>;
  customHomes: Record<string, CustomHomeDef>;
  chatMessages: ChatMessage[];
  chatChannel: 'global' | 'proximity';
  friendRequests: FriendRequest[];

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
  setAdminSession: (isAdmin: boolean, adminToken: string | null) => void;
  setPendingInstagramDraft: (handle: string) => void;
  setProfile: (profile: PlayerProfile | null) => void;
  patchProfile: (partial: Partial<PlayerProfile>) => void;
  setHealth: (hp: number) => void;
  setActiveVehicleId: (id: string | null) => void;
  openVehiclePrompt: (vehicleId: string) => void;
  setTelemetry: (speedKmh: number, altitude: number, districtName: string, pos: { x: number; y: number; z: number; rotY: number }) => void;
  setSocketConnected: (connected: boolean) => void;
  setSessionReplacedMessage: (msg: string | null) => void;
  setRemotePlayers: (players: Record<string, NetworkPlayer>) => void;
  upsertRemotePlayer: (player: NetworkPlayer) => void;
  removeRemotePlayer: (uid: string) => void;
  setVehicles: (vehicles: VehicleState[]) => void;
  updateVehicle: (vehicle: VehicleState) => void;
  setWorldProperties: (props: Record<string, WorldPropertyOwnership>) => void;
  upsertWorldProperty: (prop: WorldPropertyOwnership) => void;
  setCustomHomes: (homes: Record<string, CustomHomeDef>) => void;
  upsertCustomHome: (home: CustomHomeDef) => void;
  removeCustomHome: (homeId: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatChannel: (ch: 'global' | 'proximity') => void;
  addFriendRequest: (req: FriendRequest) => void;
  removeFriendRequest: (fromUid: string) => void;
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

const initialVehiclesMap: Record<string, VehicleState> = {};
for (const v of INITIAL_VEHICLES) {
  initialVehiclesMap[v.id] = { ...v };
}

export const useGameStore = create<GameState>((set) => ({
  authReady: false,
  firebaseUser: null,
  screen: 'loading',
  isEditingExistingCharacter: false,
  isAdmin: false,
  adminToken: null,
  pendingInstagramDraft: '',

  profile: null,
  health: 100,
  activeVehicleId: null,
  pendingVehiclePromptId: null,
  localSpeedKmh: 0,
  localAltitude: 0,
  currentDistrictName: 'Central Fountain Square',
  localPos: { x: 0, y: 0, z: 16, rotY: 0 },

  socketConnected: false,
  sessionReplacedMessage: null,
  remotePlayers: {},
  vehicles: initialVehiclesMap,
  worldProperties: {},
  customHomes: {},
  chatMessages: [],
  chatChannel: 'global',
  friendRequests: [],

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
  setAdminSession: (isAdmin, adminToken) => set({ isAdmin, adminToken }),
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
  setHealth: (health) => set({ health: Math.max(0, Math.min(100, health)) }),
  setActiveVehicleId: (activeVehicleId) => set({ activeVehicleId }),
  openVehiclePrompt: (vehicleId) =>
    set({ pendingVehiclePromptId: vehicleId, activePanel: 'vehicle_prompt' }),
  setTelemetry: (localSpeedKmh, localAltitude, currentDistrictName, localPos) =>
    set({ localSpeedKmh, localAltitude, currentDistrictName, localPos }),
  setSocketConnected: (socketConnected) => set({ socketConnected }),
  setSessionReplacedMessage: (sessionReplacedMessage) => set({ sessionReplacedMessage }),
  setRemotePlayers: (remotePlayers) => set({ remotePlayers }),
  upsertRemotePlayer: (player) =>
    set((s) => ({
      remotePlayers: { ...s.remotePlayers, [player.uid]: player },
    })),
  removeRemotePlayer: (uid) =>
    set((s) => {
      const next = { ...s.remotePlayers };
      delete next[uid];
      return { remotePlayers: next };
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
  addChatMessage: (msg) =>
    set((s) => {
      if (s.chatMessages.some((m) => m.id === msg.id)) return s;
      return { chatMessages: [...s.chatMessages.slice(-79), msg] };
    }),
  setChatChannel: (chatChannel) => set({ chatChannel }),
  addFriendRequest: (req) =>
    set((s) => {
      if (s.friendRequests.some((r) => r.fromUid === req.fromUid)) return s;
      return { friendRequests: [...s.friendRequests, req] };
    }),
  removeFriendRequest: (fromUid) =>
    set((s) => ({
      friendRequests: s.friendRequests.filter((r) => r.fromUid !== fromUid),
    })),
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
  setActivePanel: (activePanel) => set({ activePanel }),
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
      adminToken: null,
      activeVehicleId: null,
      pendingVehiclePromptId: null,
      activeWorkShift: null,
      waypointTarget: null,
      remotePlayers: {},
      chatMessages: [],
      friendRequests: [],
      activePanel: null,
      nearbyPrompt: null,
      socketConnected: false,
      sessionReplacedMessage: null,
    }),
}));

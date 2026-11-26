import { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Briefcase,
  Building2,
  Bus,
  Car,
  Check,
  Clock,
  Coffee,
  Coins,
  Compass,
  Crown,
  ExternalLink,
  Gamepad2,
  Gift,
  Hammer,
  Heart,
  Home,
  KeyRound,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Package,
  Phone,
  PhoneOff,
  Play,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Ticket,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import type {
  CustomHomeStyle,
  CustomShopType,
  GardenStyle,
  InteriorTheme,
  ShopSizeTier,
  TimeOfDayMode,
  WeatherMode,
} from '../shared/types.ts';
import {
  ACTIVE_BUILDINGS,
  BUSINESSES,
  CUSTOM_HOME_PLANS,
  CUSTOM_SHOP_PLANS,
  DAILY_LOGIN_REWARDS,
  MAX_WORLD_HALF_SIZE,
  MISSIONS,
  PALACE_VILLAS,
  PROPERTIES,
  REWARDS,
  SHOP_ITEMS,
  SHOP_SIZE_TIERS,
  SHOWCASE_ADS,
  WEDDING_FEAST_MENU,
  WORK_JOBS,
  WORLD_HALF_SIZE,
  computeHouseTotalPrice,
  computeShopTotalPrice,
  isPositionOnRoad,
} from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';
import { multiplayer } from '../lib/multiplayer.ts';
import { voiceChat } from '../lib/voiceChat.ts';
import { getTodayDateKey, sanitizeInstagramId, signOutPlayer } from '../lib/firebase.ts';
import { playSfx } from '../game/audio.ts';
import { AdminFollowersTab } from './AdminFollowersTab.tsx';
import { PlayerAvatarDP } from './PlayerAvatarDP.tsx';
import { PositionSelector } from './PositionSelector.tsx';
import { PhoneModal } from './PhoneModal.tsx';
import { GameCenterModal } from './GameCenterModal.tsx';

const HOME_WALL_COLORS = ['#ece6da', '#d6c3a5', '#f1f5f9', '#dbeafe', '#fde68a', '#e2d4f0'];
const HOME_ROOF_COLORS = ['#2c3e50', '#5c4033', '#1e3a5f', '#7c2d12', '#14532d', '#312e81'];

export function GamePanels() {
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const profile = useGameStore((s) => s.profile);
  const firebaseUser = useGameStore((s) => s.firebaseUser);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const localPos = useGameStore((s) => s.localPos);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const vehicles = useGameStore((s) => s.vehicles);
  const pendingVehiclePromptId = useGameStore((s) => s.pendingVehiclePromptId);
  const worldProperties = useGameStore((s) => s.worldProperties);
  const customHomes = useGameStore((s) => s.customHomes);
  const customShops = useGameStore((s) => s.customShops);
  const palaceVillas = useGameStore((s) => s.palaceVillas);
  const villaAccess = useGameStore((s) => s.villaAccess);
  const activeVillaId = useGameStore((s) => s.activeVillaId);
  const openVillaPanel = useGameStore((s) => s.openVillaPanel);
  const unlockedShopIds = useGameStore((s) => s.unlockedShopIds);
  const publicBus = useGameStore((s) => s.publicBus);
  const publicAds = useGameStore((s) => s.publicAds);
  const villageHalfSize = useGameStore((s) => s.villageHalfSize);
  const activeBuildingId = useGameStore((s) => s.activeBuildingId);
  const openBuildingPanel = useGameStore((s) => s.openBuildingPanel);
  const activeCustomShopId = useGameStore((s) => s.activeCustomShopId);
  const openPlayerShopPanel = useGameStore((s) => s.openPlayerShopPanel);
  const setShowWorldMapModal = useGameStore((s) => s.setShowWorldMapModal);
  const mingleEvent = useGameStore((s) => s.mingleEvent);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const chatChannel = useGameStore((s) => s.chatChannel);
  const setChatChannel = useGameStore((s) => s.setChatChannel);
  const directChatTargetUid = useGameStore((s) => s.directChatTargetUid);
  const setDirectChatTargetUid = useGameStore((s) => s.setDirectChatTargetUid);
  const voiceJoined = useGameStore((s) => s.voiceJoined);
  const voiceMuted = useGameStore((s) => s.voiceMuted);
  const voiceMode = useGameStore((s) => s.voiceMode);
  const voiceError = useGameStore((s) => s.voiceError);
  const localSpeaking = useGameStore((s) => s.localSpeaking);
  const voicePeers = useGameStore((s) => s.voicePeers);
  const friendRequests = useGameStore((s) => s.friendRequests);
  const activeMissionId = useGameStore((s) => s.activeMissionId);
  const setActiveMissionId = useGameStore((s) => s.setActiveMissionId);
  const activeWorkShift = useGameStore((s) => s.activeWorkShift);
  const setActiveWorkShift = useGameStore((s) => s.setActiveWorkShift);
  const setWaypointTarget = useGameStore((s) => s.setWaypointTarget);
  const transactions = useGameStore((s) => s.transactions);
  const businessCooldowns = useGameStore((s) => s.businessCooldowns);
  const workCooldowns = useGameStore((s) => s.workCooldowns);
  const dailyRewardReadyAt = useGameStore((s) => s.dailyRewardReadyAt);
  const activeNpcDialog = useGameStore((s) => s.activeNpcDialog);
  const timeOfDayMode = useGameStore((s) => s.timeOfDayMode);
  const setTimeOfDayMode = useGameStore((s) => s.setTimeOfDayMode);
  const weatherMode = useGameStore((s) => s.weatherMode);
  const setWeatherMode = useGameStore((s) => s.setWeatherMode);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const setAudioEnabled = useGameStore((s) => s.setAudioEnabled);
  const showMobileControls = useGameStore((s) => s.showMobileControls);
  const setShowMobileControls = useGameStore((s) => s.setShowMobileControls);
  const fps = useGameStore((s) => s.fps);
  const setScreen = useGameStore((s) => s.setScreen);
  const setHealth = useGameStore((s) => s.setHealth);
  const requestTeleport = useGameStore((s) => s.requestTeleport);
  const pushToast = useGameStore((s) => s.pushToast);
  const resetForLogout = useGameStore((s) => s.resetForLogout);

  const [chatText, setChatText] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Sub-tabs
  const [worksTab, setWorksTab] = useState<'jobs' | 'rewards'>('jobs');
  const [homesTab, setHomesTab] = useState<'build' | 'estates'>('build');
  const [shopsTab, setShopsTab] = useState<'open' | 'browse'>('open');
  const [adminTab, setAdminTab] = useState<'build' | 'world' | 'homes' | 'players' | 'followers'>('build');
  const [autoSelectingMingle, setAutoSelectingMingle] = useState(false);
  const [rouletteHighlightIdx, setRouletteHighlightIdx] = useState<number | null>(null);

  // Search Panel state
  const [searchQuery, setSearchQuery] = useState('');

  // Palace Villa state
  const [villaKeyInput, setVillaKeyInput] = useState('');
  const [villaRenameInput, setVillaRenameInput] = useState('');
  const [villaNewKeyInput, setVillaNewKeyInput] = useState('');
  const [villaFeeInput, setVillaFeeInput] = useState('150');

  // Public Ad Center form state
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adHandle, setAdHandle] = useState('');
  const [adAccent, setAdAccent] = useState('#10b981');

  // Player Custom Shop Builder Form (Tea Stall / Chaya Kada & more!)
  const [shopName, setShopName] = useState('');
  const [shopType, setShopType] = useState<CustomShopType>('tea_stall');
  const [shopSizeTier, setShopSizeTier] = useState<ShopSizeTier>('small');
  const [shopHasSeating, setShopHasSeating] = useState(false);
  const [shopHasAc, setShopHasAc] = useState(false);
  const [shopAwning, setShopAwning] = useState('#e11d48');
  const [shopOwnerKey, setShopOwnerKey] = useState('');
  const [shopPos, setShopPos] = useState<{ x: number; z: number }>({ x: 34, z: 28 });

  // Shop Owner Inside Key Unlock & Change state
  const [shopUnlockInput, setShopUnlockInput] = useState('');
  const [shopChangeKeyInput, setShopChangeKeyInput] = useState('');

  // Player Custom Home Builder Form
  const [homeName, setHomeName] = useState('');
  const [homeStyle, setHomeStyle] = useState<CustomHomeStyle>('cabin');
  const [homeWall, setHomeWall] = useState(HOME_WALL_COLORS[0]);
  const [homeRoof, setHomeRoof] = useState(HOME_ROOF_COLORS[0]);
  const [homePool, setHomePool] = useState(false);
  const [homeHasGarden, setHomeHasGarden] = useState(false);
  const [homeHasAc, setHomeHasAc] = useState(false);
  const [homeInterior, setHomeInterior] = useState<InteriorTheme>('modern');
  const [homeGarden, setHomeGarden] = useState<GardenStyle>('flowers');
  const [homePos, setHomePos] = useState<{ x: number; z: number }>({ x: -210, z: -85 });

  // Admin Studio Builder & World Management Form
  const [adminTargetMode, setAdminTargetMode] = useState<'online' | 'custom'>('online');
  const [adminSelectedUid, setAdminSelectedUid] = useState<string>('self');
  const [adminCustomOwnerName, setAdminCustomOwnerName] = useState('');
  const [adminCustomOwnerInsta, setAdminCustomOwnerInsta] = useState('');
  const [adminHomeName, setAdminHomeName] = useState('');
  const [adminHomeStyle, setAdminHomeStyle] = useState<CustomHomeStyle>('villa');
  const [adminWall, setAdminWall] = useState(HOME_WALL_COLORS[0]);
  const [adminRoof, setAdminRoof] = useState(HOME_ROOF_COLORS[2]);
  const [adminPool, setAdminPool] = useState(true);
  const [adminPos, setAdminPos] = useState<{ x: number; z: number }>({ x: -235, z: -95 });
  const [adminVillageSlider, setAdminVillageSlider] = useState<number>(villageHalfSize);
  const [adminUpdateTitle, setAdminUpdateTitle] = useState('');
  const [adminUpdateMsg, setAdminUpdateMsg] = useState('');
  const [adminShopEditId, setAdminShopEditId] = useState('');
  const [adminShopEditTier, setAdminShopEditTier] = useState<ShopSizeTier>('large');
  const [adminShopEditPos, setAdminShopEditPos] = useState<{ x: number; z: number }>({ x: 34, z: 28 });

  useEffect(() => {
    setAdminVillageSlider(villageHalfSize);
  }, [villageHalfSize]);

  useEffect(() => {
    if (
      activePanel !== 'businesses' &&
      activePanel !== 'works' &&
      activePanel !== 'mingle' &&
      activePanel !== 'transit'
    ) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activePanel]);

  if (!activePanel || !profile) return null;

  if (activePanel === 'phone') {
    return <PhoneModal />;
  }
  if (activePanel === 'game_center') {
    return <GameCenterModal />;
  }

  const close = () => {
    playSfx('click');
    setActivePanel(null);
  };

  const teleportTo = (x: number, z: number, label: string) => {
    requestTeleport({ x, y: 0, z });
    pushToast('Fast Travel', `Arrived at ${label}`, 'sky');
    setActivePanel(null);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatText.trim();
    if (!trimmed) return;
    if (chatChannel === 'direct') {
      if (!directChatTargetUid) {
        pushToast('Pick a Player', 'Select an online player to send a direct message.', 'amber');
        return;
      }
      multiplayer.sendChat(trimmed, 'direct', directChatTargetUid);
    } else {
      multiplayer.sendChat(trimmed, chatChannel);
    }
    setChatText('');
  };

  const handleLogout = async () => {
    multiplayer.disconnect();
    await signOutPlayer();
    resetForLogout();
  };

  const handleBuildPlayerHome = (e: React.FormEvent) => {
    e.preventDefault();
    const road = isPositionOnRoad(homePos.x, homePos.z, 13);
    if (road.onRoad) {
      pushToast('Blocked: Road Area', road.reason || 'Choose a green off-road plot!', 'rose');
      return;
    }
    multiplayer.buildPlayerHome({
      name: homeName.trim() || `${profile.displayName}'s Home`,
      style: homeStyle,
      wallColor: homeWall,
      roofColor: homeRoof,
      hasPool: homePool,
      hasGarden: homeHasGarden,
      hasAc: homeHasAc,
      interiorTheme: homeInterior,
      gardenStyle: homeGarden,
      x: homePos.x,
      z: homePos.z,
    });
    setHomeName('');
    setActivePanel(null);
  };

  const handleAdminBuildHome = (e: React.FormEvent) => {
    e.preventDefault();
    const road = isPositionOnRoad(adminPos.x, adminPos.z, 13);
    if (road.onRoad) {
      pushToast('Blocked: Road Area', road.reason || 'Choose a clear off-road plot!', 'rose');
      return;
    }
    let targetUid = '';
    let ownerName = adminCustomOwnerName.trim() || 'Valley Resident';
    let ownerInstagram = sanitizeInstagramId(adminCustomOwnerInsta);

    if (adminTargetMode === 'online') {
      if (adminSelectedUid === 'self') {
        targetUid = profile.uid;
        ownerName = profile.displayName;
        ownerInstagram = profile.instagramId;
      } else {
        const rp = remotePlayers[adminSelectedUid];
        if (rp) {
          targetUid = rp.uid;
          ownerName = rp.displayName;
          ownerInstagram = rp.instagramId;
        }
      }
    }

    multiplayer.adminBuildHome({
      targetUid,
      ownerName,
      ownerInstagram,
      name: adminHomeName.trim() || `${ownerName}'s Villa`,
      style: adminHomeStyle,
      wallColor: adminWall,
      roofColor: adminRoof,
      hasPool: adminPool,
      hasGarden: true,
      hasAc: true,
      interiorTheme: 'luxury',
      gardenStyle: 'poolside',
      x: adminPos.x,
      z: adminPos.z,
    });
    setAdminHomeName('');
    setActivePanel(null);
  };

  const handleOpenCustomShop = (e: React.FormEvent) => {
    e.preventDefault();
    const road = isPositionOnRoad(shopPos.x, shopPos.z, 9);
    if (road.onRoad) {
      pushToast('Blocked: Road Area', road.reason || 'Cannot place shop on road!', 'rose');
      return;
    }
    if (shopOwnerKey.trim().length < 4) {
      pushToast('Secret Key Needed', 'Set a 4+ character Secret Key to unlock inside your shop.', 'amber');
      return;
    }
    const plan = CUSTOM_SHOP_PLANS.find((p) => p.shopType === shopType) || CUSTOM_SHOP_PLANS[0];
    multiplayer.openCustomShop({
      name: shopName.trim() || `${profile.displayName}'s ${plan.label.split(' ')[0]}`,
      shopType,
      sizeTier: shopSizeTier,
      hasSeating: shopHasSeating,
      hasAc: shopHasAc,
      awningColor: shopAwning,
      ownerKey: shopOwnerKey.trim(),
      x: shopPos.x,
      z: shopPos.z,
    });
    setShopName('');
    setShopOwnerKey('');
    setActivePanel(null);
  };

  // =========================================================================
  // WALK-UP VEHICLE RENT / BUY MODAL (Triggered only when standing next to vehicle)
  // =========================================================================
  if (activePanel === 'vehicle_prompt' && pendingVehiclePromptId) {
    const veh = vehicles[pendingVehiclePromptId];
    if (!veh) return null;
    const canAffordRent = profile.greenCoins >= veh.rentPrice;
    const canAffordBuy = profile.greenCoins >= veh.buyPrice;

    return (
      <div className="fixed inset-0 z-40 bg-black/72 flex items-center justify-center p-4 pointer-events-auto">
        <div className="w-full max-w-md bg-[#0e151b] border border-white/15 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-10 rounded-sm border border-white/20 shrink-0"
                style={{ backgroundColor: veh.color }}
              />
              <div>
                <h2 className="font-display text-lg font-bold text-white">{veh.name}</h2>
                <p className="text-xs text-slate-400 capitalize">
                  {veh.kind.replace('_', ' ')} · Top {Math.round(veh.maxSpeed * 3.6)} km/h
                  {veh.canFly ? ' · Vertical Flight' : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close vehicle prompt"
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            You walked up to <strong className="text-white">{veh.name}</strong>. Spend Green Coins
            to rent it for this ride or unlock it permanently so you can walk up and drive it free
            anytime.
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              disabled={!canAffordRent}
              onClick={() => multiplayer.enterVehicle(veh.id, 'rent')}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Rent for This Drive</span>
              <span className="font-mono-nums">{veh.rentPrice} GC</span>
            </button>
            <button
              type="button"
              disabled={!canAffordBuy}
              onClick={() => multiplayer.enterVehicle(veh.id, 'buy')}
              className="w-full flex items-center justify-between px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Buy Permanently (Drive Free Anytime)</span>
              <span className="font-mono-nums">{veh.buyPrice.toLocaleString()} GC</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              Your Balance:{' '}
              <strong className="font-mono-nums text-emerald-400">
                {profile.greenCoins.toLocaleString()} GC
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setActivePanel('works')}
              className="text-sky-300 hover:text-sky-200 underline cursor-pointer"
            >
              Earn coins in Works
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Online Chat & Live Voice Talk Drawer
  if (activePanel === 'chat') {
    const onlineList = Object.values(remotePlayers);
    const activeVoiceCount = Object.keys(voicePeers).length + (voiceJoined ? 1 : 0);
    const directTarget = directChatTargetUid ? remotePlayers[directChatTargetUid] : null;

    return (
      <div className="fixed bottom-24 left-5 z-30 w-[410px] max-w-[calc(100vw-2.5rem)] bg-[#0b1014]/95 border border-white/15 rounded-xl flex flex-col overflow-hidden pointer-events-auto">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-white truncate">
                Online Chat & Voice
              </div>
              <div className="text-[10px] text-slate-400 font-mono-nums">
                {onlineList.length + 1} online in Green Valley
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setChatChannel('global')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                chatChannel === 'global'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Global
            </button>
            <button
              type="button"
              onClick={() => setChatChannel('proximity')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                chatChannel === 'proximity'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Nearby
            </button>
            <button
              type="button"
              onClick={() => setChatChannel('direct')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                chatChannel === 'direct'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DM
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="p-1 text-slate-400 hover:text-white ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Voice Talk Control Bar */}
        <div className="px-3.5 py-2.5 bg-[#0e161d] border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Volume2
                className={`w-4 h-4 shrink-0 ${
                  voiceJoined ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <span className="text-xs font-semibold text-white truncate">
                {voiceJoined
                  ? `Live Voice (${activeVoiceCount} connected)`
                  : activeVoiceCount > 0
                    ? `Voice Talk (${activeVoiceCount} talking now)`
                    : 'Voice Talk (Off)'}
              </span>
            </div>

            {!voiceJoined ? (
              <button
                type="button"
                onClick={() => void voiceChat.joinVoice()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <Mic className="w-3.5 h-3.5" />
                Join Voice Talk
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    voiceChat.setMode(voiceMode === 'global' ? 'proximity' : 'global')
                  }
                  className="px-2 py-1 bg-white/8 hover:bg-white/15 text-[10px] font-medium text-slate-200 rounded-md cursor-pointer"
                >
                  {voiceMode === 'global' ? 'Global Audio' : 'Nearby 45m'}
                </button>
                <button
                  type="button"
                  onClick={() => voiceChat.toggleMute()}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                    voiceMuted
                      ? 'bg-amber-600/30 border border-amber-400/50 text-amber-200'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {voiceMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {voiceMuted ? 'Muted' : 'Mic On'}
                </button>
                <button
                  type="button"
                  onClick={() => voiceChat.leaveVoice()}
                  aria-label="Leave voice talk"
                  className="p-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 rounded-md cursor-pointer"
                >
                  <PhoneOff className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {voiceJoined && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span
                className={`px-2 py-0.5 rounded border ${
                  localSpeaking
                    ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 font-semibold'
                    : voiceMuted
                      ? 'bg-white/5 border-white/10 text-slate-400'
                      : 'bg-white/5 border-white/15 text-slate-200'
                }`}
              >
                You {voiceMuted ? '(Muted)' : localSpeaking ? '(Speaking)' : '(Ready)'}
              </span>
              {Object.values(voicePeers).map((vp) => {
                const rp = remotePlayers[vp.uid];
                return (
                  <span
                    key={vp.uid}
                    className={`px-2 py-0.5 rounded border ${
                      vp.speaking
                        ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 font-semibold'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    {rp?.displayName || 'Player'}{' '}
                    {vp.muted ? '(Muted)' : vp.speaking ? '(Speaking)' : ''}
                  </span>
                );
              })}
            </div>
          )}

          {voiceError && (
            <div className="text-[11px] text-amber-200 bg-amber-950/60 border border-amber-500/35 rounded-md px-2.5 py-1.5">
              {voiceError}
            </div>
          )}
        </div>

        {/* Direct Message Recipient Selector */}
        {chatChannel === 'direct' && (
          <div className="px-3.5 py-2 bg-[#101820] border-b border-white/10 flex items-center gap-2 text-xs">
            <span className="text-slate-400 shrink-0">To:</span>
            {onlineList.length === 0 ? (
              <span className="text-slate-500 text-[11px]">
                No other players online right now.
              </span>
            ) : (
              <select
                value={directChatTargetUid || ''}
                onChange={(e) => setDirectChatTargetUid(e.target.value || null)}
                className="flex-1 px-2.5 py-1 bg-[#0a1015] border border-white/15 rounded-md text-xs text-white outline-none"
              >
                <option value="">Choose an online player...</option>
                {onlineList.map((rp) => (
                  <option key={rp.uid} value={rp.uid}>
                    {rp.displayName}
                    {rp.instagramId ? ` (@${rp.instagramId})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="h-56 overflow-y-auto p-3.5 space-y-2.5 text-xs">
          {chatMessages.length === 0 ? (
            <p className="text-slate-400 text-center py-8 leading-relaxed">
              No messages yet. Say hello to other players in Green Valley or click Join Voice Talk
              above to speak live!
            </p>
          ) : (
            chatMessages.map((m) => (
              <div key={m.id} className="leading-relaxed break-words">
                {m.channel === 'system' ? (
                  <span className="text-emerald-400/90 italic">{m.text}</span>
                ) : (
                  <>
                    <span
                      className={`mr-1.5 text-[10px] font-medium ${
                        m.channel === 'direct'
                          ? 'text-amber-300'
                          : m.channel === 'proximity'
                            ? 'text-sky-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {m.channel === 'direct'
                        ? `[DM${m.targetName ? ` → ${m.targetName}` : ''}]`
                        : m.channel === 'proximity'
                          ? '[Nearby]'
                          : '[Global]'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (m.uid !== firebaseUser?.uid && remotePlayers[m.uid]) {
                          setDirectChatTargetUid(m.uid);
                        }
                      }}
                      className="font-semibold text-white hover:text-emerald-300 mr-1 cursor-pointer"
                    >
                      {m.displayName}
                    </button>
                    {m.isAdmin && (
                      <span className="text-[10px] font-semibold text-amber-400 mr-1">ADMIN</span>
                    )}
                    {m.instagramId && (
                      <span className="text-[10px] text-sky-300/80 mr-1.5">@{m.instagramId}</span>
                    )}
                    <span className="text-slate-200">{m.text}</span>
                  </>
                )}
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        <form onSubmit={handleSendChat} className="p-3 border-t border-white/10 flex gap-2">
          <input
            type="text"
            autoFocus
            value={chatText}
            maxLength={180}
            onChange={(e) => setChatText(e.target.value)}
            placeholder={
              chatChannel === 'direct'
                ? directTarget
                  ? `Direct message to ${directTarget.displayName}...`
                  : 'Select an online player above to message...'
                : chatChannel === 'proximity'
                  ? 'Message players within 40m...'
                  : 'Message everyone online in Green Valley...'
            }
            className="flex-1 px-3 py-2 bg-[#121a21] border border-white/15 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    );
  }

  // NPC Dialogue Card
  if (activePanel === 'npc' && activeNpcDialog) {
    return (
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 w-[520px] max-w-[calc(100vw-2rem)] bg-[#0b1014]/95 border border-white/15 rounded-xl p-5 space-y-3 pointer-events-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">{activeNpcDialog.name}</h2>
            <p className="text-xs text-emerald-400">{activeNpcDialog.role}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close dialogue"
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">{activeNpcDialog.dialogue}</p>
        <div className="flex items-center justify-end gap-2 pt-1">
          {activeNpcDialog.canHeal && (
            <button
              type="button"
              onClick={() => {
                setHealth(100);
                pushToast('Health Restored', 'Dr. Sara restored your health to 100%', 'emerald');
                close();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5" />
              Restore Health (Free)
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Main Pause / Village Hub Menu (ESC)
  if (activePanel === 'pause') {
    const menuItems: { label: string; icon: React.ReactNode; action: () => void }[] = [
      { label: 'Resume Green Valley', icon: <Play className="w-4 h-4 text-emerald-400" />, action: close },
      { label: 'Typixel Smartphone (Private Calls & Updates)', icon: <Smartphone className="w-4 h-4 text-emerald-400" />, action: () => setActivePanel('phone') },
      { label: 'House & Person Search', icon: <Search className="w-4 h-4 text-sky-400" />, action: () => setActivePanel('search') },
      { label: 'Grand Game Center (54 Playable Games)', icon: <Gamepad2 className="w-4 h-4 text-purple-400" />, action: () => setActivePanel('game_center') },
      { label: 'Active Buildings (Hospital, Govt Hall, Gym, Tea Stall...)', icon: <Building2 className="w-4 h-4 text-sky-400" />, action: () => openBuildingPanel('bldg-hospital') },
      { label: 'KSRTC 24/7 Public Bus & Conductor Salary', icon: <Bus className="w-4 h-4 text-red-400" />, action: () => setActivePanel('transit') },
      { label: 'Start Your Own Shop (Tea Stall & More)', icon: <Coffee className="w-4 h-4 text-rose-400" />, action: () => setActivePanel('shops') },
      { label: "Build Homes & Royal Villas (Hashim's / Rifad's)", icon: <Home className="w-4 h-4 text-emerald-400" />, action: () => setActivePanel('properties') },
      { label: 'Single-to-Mingle (5-Min Round & Free Honeymoon)', icon: <Heart className="w-4 h-4 text-rose-400" />, action: () => setActivePanel('mingle') },
      { label: 'Public Ad Center (Publish Village Billboards)', icon: <Megaphone className="w-4 h-4 text-amber-400" />, action: () => setActivePanel('ads') },
      { label: 'Weekly Login Reward (Once Per Week)', icon: <Gift className="w-4 h-4 text-amber-400" />, action: () => setActivePanel('daily_reward') },
      { label: 'Works & Salary Jobs', icon: <Briefcase className="w-4 h-4 text-emerald-400" />, action: () => setActivePanel('works') },
      { label: 'Walk-Up Vehicles & Businesses', icon: <Car className="w-4 h-4 text-sky-400" />, action: () => setActivePanel('vehicles') },
      { label: 'Inventory & Mall Shop', icon: <ShoppingBag className="w-4 h-4 text-sky-300" />, action: () => setActivePanel('inventory') },
      { label: 'Friends & Online Players', icon: <UserCheck className="w-4 h-4 text-emerald-400" />, action: () => setActivePanel('friends') },
      {
        label: 'Customize Character & Dress',
        icon: <Users className="w-4 h-4 text-pink-400" />,
        action: () => {
          setActivePanel(null);
          setScreen('character', true);
        },
      },
      {
        label: 'Interactive Zoomable World Map (M)',
        icon: <MapIcon className="w-4 h-4 text-emerald-400" />,
        action: () => {
          setActivePanel(null);
          setShowWorldMapModal(true);
        },
      },
      ...(isAdmin
        ? [
            {
              label: 'Admin Studio (Expand Village, Homes & Alerts)',
              icon: <ShieldCheck className="w-4 h-4 text-amber-400" />,
              action: () => setActivePanel('admin'),
            },
          ]
        : []),
      { label: 'Settings & Atmosphere', icon: <Settings className="w-4 h-4 text-slate-300" />, action: () => setActivePanel('settings') },
    ];

    return (
      <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4 pointer-events-auto">
        <div className="w-full max-w-md bg-[#0e151b] border border-white/15 rounded-xl p-6 space-y-5 max-h-[88vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-white">TYPIXEL OPEN WORLD</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {profile.displayName}
                {profile.instagramId ? ` · @${profile.instagramId}` : ''} · Lv.{profile.level} ·{' '}
                <span className="font-mono-nums text-emerald-400">{profile.greenCoins} GC</span>
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close pause menu"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#131d25] hover:bg-[#1a2833] border border-white/8 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer text-left"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-500">ESC to close menu</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/30 text-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Never open Admin Studio for non-admin users
  if (activePanel === 'admin' && !isAdmin) {
    return null;
  }

  // Standard Centered Modal Panels
  const panelMeta: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
    daily_reward: {
      title: 'Weekly Login Reward (Once Per Week)',
      subtitle: 'Claim escalating Green Coin chests once every 7 days',
      icon: <Gift className="w-5 h-5 text-amber-400" />,
    },
    search: {
      title: 'House & Person Search',
      subtitle: 'Find Palace Villas, Custom Homes, Citizen Shops, or Online Citizens by Name / @Instagram',
      icon: <Search className="w-5 h-5 text-sky-400" />,
    },
    villa: {
      title: 'Royal Walled Palace Villa',
      subtitle: 'Visit outside grounds with Green Coins or unlock inside with the Secret House Key',
      icon: <Crown className="w-5 h-5 text-amber-400" />,
    },
    transit: {
      title: 'KSRTC 24/7 Public Bus & Conductor',
      subtitle: 'Full-time village bus loop — ride with tickets or work as Conductor for time-based salary',
      icon: <Bus className="w-5 h-5 text-red-400" />,
    },
    ads: {
      title: 'Green Valley Public Ad Center',
      subtitle: 'Publish your own public billboard ad across Green Valley for 200 GC',
      icon: <Megaphone className="w-5 h-5 text-amber-400" />,
    },
    building: {
      title: 'Active Valley Buildings & Government Services',
      subtitle: 'Hospital, Government Services Hall, Gym, Park, Tea Stall, Mall, Bank, School, Cinema & More',
      icon: <Building2 className="w-5 h-5 text-sky-400" />,
    },
    shops: {
      title: 'Start Your Own Shop (Off-Road Plot & Secret Owner Key)',
      subtitle: 'Choose Small / Medium / Large / Palace size, facilities, and set your private interior key',
      icon: <Store className="w-5 h-5 text-rose-400" />,
    },
    player_shop: {
      title: 'Citizen Shop Counter & Owner Access',
      subtitle: 'Order tea & snacks to visibly hold & drink in hand, or unlock inside with Owner Key',
      icon: <Coffee className="w-5 h-5 text-amber-400" />,
    },
    mingle: {
      title: 'Single-to-Mingle · Max 5-Min Round · Free Feast & Honeymoon',
      subtitle: 'Auto-selects 2 live accounts with DPs, smart boy/girl replacement, free wedding feast to all & free honeymoon',
      icon: <Heart className="w-5 h-5 text-rose-400" />,
    },
    works: {
      title: 'Works & Salary Jobs Center',
      subtitle: 'Take repeatable Green Valley jobs (Auto, Bus, Tea Shop, Doctor & more) to earn Green Coins',
      icon: <Briefcase className="w-5 h-5 text-emerald-400" />,
    },
    missions: {
      title: 'Green Valley Missions',
      subtitle: 'Complete exploration, delivery, sports & valley objectives',
      icon: <Compass className="w-5 h-5 text-amber-400" />,
    },
    properties: {
      title: 'Home Builder, Estates & Royal Palace Villas',
      subtitle: 'Pick an off-road plot, select Small/Medium/Large/Palace tier & facilities, or visit Royal Villas',
      icon: <Home className="w-5 h-5 text-emerald-400" />,
    },
    businesses: {
      title: 'Businesses & Passive Income',
      subtitle: 'Acquire cafes, restaurants & venues to earn Green Coins',
      icon: <Building2 className="w-5 h-5 text-amber-400" />,
    },
    vehicles: {
      title: 'KSRTC Bus & Walk-Up Vehicles',
      subtitle: 'Drive walk-up vehicles or hop onto the 24/7 automated KSRTC Bus',
      icon: <Car className="w-5 h-5 text-sky-400" />,
    },
    friends: {
      title: 'Online Players & Friends',
      subtitle: 'Connect with real players exploring Green Valley and call or DM them',
      icon: <Users className="w-5 h-5 text-emerald-400" />,
    },
    inventory: {
      title: 'Inventory & Grand Valley Shop',
      subtitle: 'Use supplies to hold & restore health or purchase gear with Green Coins',
      icon: <ShoppingBag className="w-5 h-5 text-sky-400" />,
    },
    wallet: {
      title: 'Green Coins Wallet & ATM',
      subtitle: 'Server-validated balance and persistent transaction ledger',
      icon: <Coins className="w-5 h-5 text-emerald-400" />,
    },
    admin: {
      title: 'Green Valley Admin Studio',
      subtitle: 'Expand village size, relocate/expand shops, broadcast Typixel alerts & build homes',
      icon: <ShieldCheck className="w-5 h-5 text-amber-400" />,
    },
    settings: {
      title: 'World Settings & Atmosphere',
      subtitle: 'Adjust day/night lighting, weather effects, controls & audio',
      icon: <Settings className="w-5 h-5 text-slate-300" />,
    },
  };

  const meta = panelMeta[activePanel];

  return (
    <div className="fixed inset-0 z-40 bg-black/68 flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[84vh] bg-[#0e151b] border border-white/15 rounded-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {meta?.icon}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-white truncate">{meta?.title}</h2>
              <p className="text-xs text-slate-400 truncate">{meta?.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-xs font-mono-nums font-bold text-emerald-400">
                {profile.greenCoins.toLocaleString()} GC
              </div>
              <div className="text-[10px] text-slate-400">Balance</div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close panel"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* =============================================================== */}
          {/* WEEKLY LOGIN REWARD CALENDAR PANEL (ONCE PER WEEK)              */}
          {/* =============================================================== */}
          {activePanel === 'daily_reward' && (() => {
            const today = getTodayDateKey();
            const prevMs = profile.lastDailyLoginDate
              ? Date.parse(`${profile.lastDailyLoginDate}T00:00:00Z`)
              : 0;
            const todayMs = Date.parse(`${today}T00:00:00Z`);
            const daysSince = prevMs && Number.isFinite(prevMs)
              ? Math.floor((todayMs - prevMs) / 86400000)
              : 999;
            const claimedThisWeek = daysSince < 7;
            const waitDays = Math.max(1, 7 - daysSince);
            const currentStreak = profile.dailyLoginStreak || 0;
            const nextWeekNum = claimedThisWeek
              ? ((Math.max(1, currentStreak) - 1) % DAILY_LOGIN_REWARDS.length) + 1
              : (currentStreak % DAILY_LOGIN_REWARDS.length) + 1;
            const activeTier = DAILY_LOGIN_REWARDS[nextWeekNum - 1];
            const featuredAd = SHOWCASE_ADS[0];

            return (
              <div className="space-y-5">
                <div className="p-4 bg-gradient-to-r from-amber-950/60 to-emerald-950/60 border border-amber-400/35 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-amber-300">
                      Weekly Streak: Week {currentStreak} · Total Claims: {profile.totalDailyLogins || 0}
                    </div>
                    <h3 className="font-display text-lg font-bold text-white">
                      {claimedThisWeek
                        ? `Weekly Reward Claimed — Next in ${waitDays} Day${waitDays > 1 ? 's' : ''}`
                        : `Week ${nextWeekNum} Bonus Ready: +${activeTier.coins} Green Coins`}
                    </h3>
                    <p className="text-xs text-slate-300">
                      {claimedThisWeek
                        ? 'Rewards can be claimed once every 7 days. Your streak is saved automatically!'
                        : `Claim your weekly Green Coin chest (+${activeTier.coins} GC & +${activeTier.xp} XP) now.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={claimedThisWeek}
                    onClick={() => multiplayer.claimDailyLogin()}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-extrabold rounded-xl transition-colors cursor-pointer shrink-0 font-mono-nums"
                  >
                    {claimedThisWeek ? `Wait ${waitDays}d ✓` : `Claim +${activeTier.coins} GC`}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {DAILY_LOGIN_REWARDS.map((tier) => {
                    const isCurrent = tier.day === nextWeekNum;
                    const isCompleted = claimedThisWeek
                      ? tier.day <= nextWeekNum
                      : tier.day < nextWeekNum;
                    return (
                      <div
                        key={tier.day}
                        className={`p-3.5 rounded-xl border space-y-1.5 ${
                          isCurrent
                            ? 'bg-amber-950/45 border-amber-400 text-white'
                            : isCompleted
                              ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                              : 'bg-[#131d25] border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>Week {tier.day}</span>
                          {isCompleted && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="font-mono-nums text-base font-extrabold text-amber-300">
                          +{tier.coins} GC
                        </div>
                        <div className="text-[10px] text-slate-400">+{tier.xp} XP</div>
                      </div>
                    );
                  })}
                </div>

                {/* Featured Typixel Showcase Banner */}
                <a
                  href={featuredAd.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-[#101820] border border-white/10 hover:border-amber-400/40 rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={featuredAd.imageUrl}
                      alt={featuredAd.title}
                      className="w-16 h-11 rounded-lg object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{featuredAd.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{featuredAd.subtitle}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                </a>
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* HOUSE & PERSON SEARCH PANEL                                     */}
          {/* =============================================================== */}
          {activePanel === 'search' && (() => {
            const q = searchQuery.trim().toLowerCase();
            const villasArr = (Object.values(palaceVillas).length
              ? Object.values(palaceVillas)
              : PALACE_VILLAS
            ).filter(
              (v) =>
                !q ||
                v.boardName.toLowerCase().includes(q) ||
                v.ownerDisplayName.toLowerCase().includes(q) ||
                v.ownerUsername.toLowerCase().includes(q),
            );
            const matchedHomes = Object.values(customHomes).filter(
              (h) =>
                !q ||
                h.name.toLowerCase().includes(q) ||
                h.ownerName.toLowerCase().includes(q) ||
                (h.ownerInstagram || '').toLowerCase().includes(q),
            );
            const matchedEstates = PROPERTIES.filter(
              (p) =>
                !q ||
                p.name.toLowerCase().includes(q) ||
                (worldProperties[p.id]?.ownerName || '').toLowerCase().includes(q),
            );
            const matchedShops = Object.values(customShops).filter(
              (sh) =>
                !q ||
                sh.name.toLowerCase().includes(q) ||
                sh.ownerName.toLowerCase().includes(q) ||
                (sh.ownerInstagram || '').toLowerCase().includes(q),
            );
            const matchedPeople = Object.values(remotePlayers).filter(
              (rp) =>
                !q ||
                rp.displayName.toLowerCase().includes(q) ||
                (rp.instagramId || '').toLowerCase().includes(q),
            );

            return (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Hashim's Villa, Rifad's Villa, any house, shop, or citizen @instagram..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#121b24] border border-white/15 focus:border-sky-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* Online People Results */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-sky-300">
                    Online Citizens ({matchedPeople.length})
                  </h3>
                  {matchedPeople.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 bg-[#131d25] border border-white/8 rounded-xl">
                      No matching online citizens right now.
                    </p>
                  ) : (
                    matchedPeople.map((rp) => (
                      <div
                        key={rp.uid}
                        className="p-3 bg-[#131d25] border border-white/10 rounded-xl flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{rp.displayName}</div>
                          <div className="text-[11px] text-sky-300 truncate">
                            {rp.instagramId ? `@${rp.instagramId}` : `Lv.${rp.level}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              multiplayer.callPlayer(rp.uid);
                              setActivePanel('phone');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDirectChatTargetUid(rp.uid);
                              setActivePanel('chat');
                            }}
                            className="px-2.5 py-1.5 bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 text-[11px] font-semibold rounded-lg cursor-pointer"
                          >
                            DM
                          </button>
                          <button
                            type="button"
                            onClick={() => teleportTo(rp.x + 2, rp.z + 2, rp.displayName)}
                            className="px-2.5 py-1.5 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-lg cursor-pointer"
                          >
                            Meet
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Royal Palace Villas */}
                {villasArr.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-amber-300">Royal Palace Villas</h3>
                    {villasArr.map((v) => (
                      <div
                        key={v.villaId}
                        className="p-3 bg-gradient-to-r from-amber-950/40 to-[#131d25] border border-amber-400/35 rounded-xl flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{v.boardName}</div>
                          <div className="text-[11px] text-amber-200 truncate">
                            Owner: {v.ownerDisplayName} (@{v.ownerUsername}) · Visit {v.visitFee} GC
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openVillaPanel(v.villaId)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                          >
                            Gate &amp; Key
                          </button>
                          <button
                            type="button"
                            onClick={() => teleportTo(v.gatePos.x, v.gatePos.z, v.boardName)}
                            className="px-2.5 py-1.5 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-lg cursor-pointer"
                          >
                            Go
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Houses & Estates */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-emerald-300">
                    Houses &amp; Estates ({matchedHomes.length + matchedEstates.length})
                  </h3>
                  {matchedHomes.map((h) => (
                    <div
                      key={h.homeId}
                      className="p-3 bg-[#131d25] border border-white/10 rounded-xl flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{h.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Owner: {h.ownerName}
                          {h.ownerInstagram ? ` (@${h.ownerInstagram})` : ''} · {h.style}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => teleportTo(h.x, h.z + 11, h.name)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg cursor-pointer shrink-0"
                      >
                        Visit House
                      </button>
                    </div>
                  ))}
                  {matchedEstates.map((p) => {
                    const own = worldProperties[p.id];
                    return (
                      <div
                        key={p.id}
                        className="p-3 bg-[#131d25] border border-white/10 rounded-xl flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {own ? `Owner: ${own.ownerName}` : `For Sale · ${p.price} GC`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => teleportTo(p.doorPosition.x, p.doorPosition.z + 2, p.name)}
                          className="px-3 py-1.5 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-lg cursor-pointer shrink-0"
                        >
                          Visit
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Citizen Shops */}
                {matchedShops.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-rose-300">
                      Citizen Shops ({matchedShops.length})
                    </h3>
                    {matchedShops.map((sh) => (
                      <div
                        key={sh.shopId}
                        className="p-3 bg-[#131d25] border border-white/10 rounded-xl flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{sh.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            Owner: {sh.ownerName}
                            {sh.ownerInstagram ? ` (@${sh.ownerInstagram})` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPlayerShopPanel(sh.shopId)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg cursor-pointer shrink-0"
                        >
                          Open Shop
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* ROYAL PALACE VILLAS PANEL (HASHIM'S VILLA & RIFAD'S VILLA)      */}
          {/* =============================================================== */}
          {activePanel === 'villa' && (() => {
            const villasMap = palaceVillas;
            const villa =
              (activeVillaId ? villasMap[activeVillaId] : null) ||
              Object.values(villasMap)[0] ||
              PALACE_VILLAS[0];
            const access = villaAccess[villa.villaId] || {
              canVisitOutside: false,
              canEnterInside: false,
            };
            const isOwner =
              profile.instagramId.toLowerCase() === villa.ownerUsername.toLowerCase();
            const canManage = isAdmin || isOwner;

            return (
              <div className="space-y-4">
                {/* Switch between Hashim's Villa & Rifad's Villa */}
                <div className="grid grid-cols-2 gap-2">
                  {PALACE_VILLAS.map((pv) => {
                    const live = villasMap[pv.villaId] || pv;
                    return (
                      <button
                        key={pv.villaId}
                        type="button"
                        onClick={() => {
                          openVillaPanel(pv.villaId);
                          setVillaRenameInput(live.boardName);
                          setVillaFeeInput(String(live.visitFee));
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          villa.villaId === pv.villaId
                            ? 'bg-amber-600/20 border-amber-400 text-white'
                            : 'bg-[#121a22] border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{live.boardName}</div>
                        <div className="text-[10px] text-amber-300 truncate">
                          @{live.ownerUsername}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Villa Overview */}
                <div className="p-4 bg-gradient-to-br from-amber-950/50 via-[#151820] to-[#101820] border border-amber-400/40 rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-amber-400" />
                        <h3 className="font-display text-lg font-extrabold text-white">
                          {villa.boardName}
                        </h3>
                      </div>
                      <p className="text-xs text-amber-200 mt-0.5">
                        Owner: {villa.ownerDisplayName} (@{villa.ownerUsername}) · Monumental Walled Palace
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => teleportTo(villa.gatePos.x, villa.gatePos.z, villa.boardName)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/18 text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
                    >
                      Go to Gate
                    </button>
                  </div>

                  {/* Action 1: Visit Outside Grounds */}
                  <div className="p-3.5 bg-[#0b1014]/85 border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white">
                        1. Visit Outside Palace Grounds &amp; Courtyard
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {canManage || access.canVisitOutside
                          ? 'Unlocked! Step inside the grand walled compound anytime.'
                          : `Anyone can tour the exterior palace garden for ${villa.visitFee} GC.`}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canManage && !access.canVisitOutside && profile.greenCoins < villa.visitFee}
                      onClick={() => multiplayer.visitVillaOutside(villa.villaId)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0 font-mono-nums"
                    >
                      {canManage || access.canVisitOutside
                        ? 'Enter Courtyard (Free)'
                        : `Pay & Visit (${villa.visitFee} GC)`}
                    </button>
                  </div>

                  {/* Action 2: Enter Inside Palace with Secret Key */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      multiplayer.unlockVillaHouse(villa.villaId, villaKeyInput);
                      setVillaKeyInput('');
                    }}
                    className="p-3.5 bg-[#0b1014]/85 border border-amber-400/25 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <span>2. Enter Inside Main Palace House (Secret Key)</span>
                      </div>
                      {!villa.hasKeySet && (
                        <span className="text-[10px] text-sky-300 font-semibold">
                          Key Not Set Yet
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={villaKeyInput}
                        onChange={(e) => setVillaKeyInput(e.target.value)}
                        placeholder={
                          canManage
                            ? 'Owner/Admin: Click Enter directly (or test key)'
                            : 'Enter Secret Palace House Key...'
                        }
                        className="flex-1 px-3 py-2 bg-[#131d25] border border-white/15 focus:border-amber-400 rounded-lg text-xs text-white outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0"
                      >
                        {canManage ? 'Enter Palace' : 'Unlock Inside'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Owner & Admin Villa Controls */}
                {canManage && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      multiplayer.updateVillaConfig(villa.villaId, {
                        boardName: villaRenameInput.trim() || undefined,
                        newKey: villaNewKeyInput.trim() || undefined,
                        visitFee: Number(villaFeeInput) || undefined,
                      });
                      setVillaNewKeyInput('');
                    }}
                    className="p-4 bg-[#131d25] border border-sky-400/35 rounded-xl space-y-3"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {isOwner ? 'Villa Owner Controls' : 'Admin Villa Management'} — Rename Board &amp; Secret Key
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Palace Board Name</label>
                        <input
                          type="text"
                          maxLength={32}
                          value={villaRenameInput}
                          onChange={(e) => setVillaRenameInput(e.target.value)}
                          placeholder={villa.boardName}
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Outside Visit Fee (GC)</label>
                        <input
                          type="number"
                          min={0}
                          max={2000}
                          value={villaFeeInput}
                          onChange={(e) => setVillaFeeInput(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Set / Change Secret Key</label>
                        <input
                          type="password"
                          maxLength={24}
                          value={villaNewKeyInput}
                          onChange={(e) => setVillaNewKeyInput(e.target.value)}
                          placeholder="Enter new secret key..."
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Save Palace Villa Settings
                    </button>
                  </form>
                )}
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* KSRTC 24/7 FULL-TIME PUBLIC BUS & CONDUCTOR PANEL               */}
          {/* =============================================================== */}
          {activePanel === 'transit' && (() => {
            const bus = publicBus;
            const myUid = firebaseUser?.uid || profile.uid;
            const amConductor = bus?.conductorUid === myUid;
            const myPass = bus?.passengers.find((p) => p.uid === myUid) || null;
            const dutySec =
              amConductor && bus?.conductorStartedAtMs
                ? Math.max(0, Math.floor((nowMs - bus.conductorStartedAtMs) / 1000))
                : 0;

            return (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-red-950/60 via-[#18141c] to-[#121a22] border border-amber-400/40 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-600 text-amber-200 text-[10px] font-extrabold rounded">
                          24/7 LIVE KSRTC
                        </span>
                        <h3 className="font-display text-base font-bold text-white">
                          {bus?.name || 'KSRTC Super Fast Village Bus'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {bus
                          ? `Now: ${bus.currentStopName} → Next: ${bus.nextStopName} · ${Math.round(bus.speed * 3.6)} km/h`
                          : 'Connecting to live KSRTC telemetry...'}
                      </p>
                    </div>
                    {bus && (
                      <button
                        type="button"
                        onClick={() => teleportTo(bus.x + 3, bus.z + 3, 'KSRTC Public Bus')}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/18 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Go to Bus
                      </button>
                    )}
                  </div>

                  {/* Passenger Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    {!myPass && !amConductor && (
                      <button
                        type="button"
                        onClick={() => multiplayer.boardPublicBus()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Board KSRTC Bus
                      </button>
                    )}
                    {myPass && (
                      <>
                        {!myPass.paidFare ? (
                          <button
                            type="button"
                            disabled={profile.greenCoins < (bus?.fare || 15)}
                            onClick={() => multiplayer.payBusFare()}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-extrabold rounded-lg cursor-pointer"
                          >
                            Pay Passenger Fare ({bus?.fare || 15} GC)
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5" />
                            {myPass.hasTicket
                              ? `Ticket Issued: #${myPass.ticketCode}`
                              : 'Fare Paid — Waiting for Conductor Ticket'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => multiplayer.leavePublicBus()}
                          className="px-3.5 py-2 bg-white/10 hover:bg-white/18 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Step Off Bus
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Conductor Duty & Time-Based Salary */}
                <div className="p-4 bg-[#131d25] border border-white/12 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        KSRTC Conductor Duty (Earn Time-Based Salary)
                      </h4>
                      <p className="text-xs text-slate-400">
                        {bus?.conductorUid
                          ? `Active Conductor: ${bus.conductorName}${amConductor ? ' (You)' : ''}`
                          : 'No conductor onboard! Take duty to collect fares, issue tickets & earn live salary.'}
                      </p>
                    </div>
                    {amConductor ? (
                      <button
                        type="button"
                        onClick={() => multiplayer.leaveBusConductor()}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        End Conductor Shift
                      </button>
                    ) : !bus?.conductorUid ? (
                      <button
                        type="button"
                        onClick={() => multiplayer.becomeBusConductor()}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Become Conductor
                      </button>
                    ) : null}
                  </div>

                  {amConductor && bus && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 bg-[#0a1015] border border-white/8 rounded-lg">
                        <div className="text-[10px] text-slate-400">Shift Time</div>
                        <div className="font-mono-nums text-sm font-bold text-white">{dutySec}s</div>
                      </div>
                      <div className="p-2.5 bg-[#0a1015] border border-white/8 rounded-lg">
                        <div className="text-[10px] text-slate-400">Salary Earned</div>
                        <div className="font-mono-nums text-sm font-bold text-emerald-400">
                          +{bus.conductorEarnedSalary} GC
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#0a1015] border border-white/8 rounded-lg">
                        <div className="text-[10px] text-slate-400">Tickets Issued</div>
                        <div className="font-mono-nums text-sm font-bold text-amber-300">
                          {bus.conductorTicketsIssued}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Onboard Passengers List */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-300">
                      Passengers Onboard ({bus?.passengers.length || 0})
                    </div>
                    {!bus || bus.passengers.length === 0 ? (
                      <p className="text-xs text-slate-500">No passengers seated on the bus right now.</p>
                    ) : (
                      bus.passengers.map((p) => (
                        <div
                          key={p.uid}
                          className="p-2.5 bg-[#0b1014] border border-white/8 rounded-lg flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{p.displayName}</span>
                            <span className="text-slate-400 ml-2">
                              {p.hasTicket
                                ? `Ticket #${p.ticketCode}`
                                : p.paidFare
                                  ? 'Paid Fare (Needs Ticket)'
                                  : 'Unpaid'}
                            </span>
                          </div>
                          {amConductor && !p.hasTicket && (
                            <button
                              type="button"
                              onClick={() => multiplayer.issueBusTicket(p.uid)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded cursor-pointer"
                            >
                              Issue Ticket (+25 GC)
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* PUBLIC AD CENTER PANEL                                          */}
          {/* =============================================================== */}
          {activePanel === 'ads' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!adTitle.trim()) return;
                  multiplayer.publishPublicAd({
                    title: adTitle.trim(),
                    subtitle: adSubtitle.trim() || 'Visit our Green Valley spot!',
                    instagramHandle: adHandle.trim() || profile.instagramId,
                    accentColor: adAccent,
                  });
                  setAdTitle('');
                  setAdSubtitle('');
                }}
                className="p-4 bg-[#131d25] border border-amber-400/30 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Publish Public Village Ad</h3>
                  <span className="text-xs font-mono-nums font-bold text-amber-300">
                    {isAdmin ? 'FREE (Admin)' : '200 GC'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    maxLength={42}
                    value={adTitle}
                    onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="Ad Headline (e.g. Hot Masala Chai @ Plaza!)"
                    className="px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    maxLength={30}
                    value={adHandle}
                    onChange={(e) => setAdHandle(e.target.value)}
                    placeholder={`@instagram (default @${profile.instagramId || 'typixelofficial'})`}
                    className="px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                  />
                </div>
                <input
                  type="text"
                  maxLength={96}
                  value={adSubtitle}
                  onChange={(e) => setAdSubtitle(e.target.value)}
                  placeholder="Promo details, shop location, or special offer..."
                  className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {['#10b981', '#f59e0b', '#e11d48', '#38bdf8', '#a855f7'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAdAccent(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full cursor-pointer ${
                          adAccent === c ? 'ring-2 ring-white' : 'opacity-75'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={!isAdmin && profile.greenCoins < 200}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Publish Public Ad ({isAdmin ? 'FREE' : '200 GC'})
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300">
                  Live Citizen Public Ads ({publicAds.length})
                </h4>
                {publicAds.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-[#131d25] border border-white/8 rounded-xl">
                    No citizen ads published yet — be the first to advertise your shop or event!
                  </p>
                ) : (
                  publicAds.map((ad) => (
                    <div
                      key={ad.adId}
                      className="p-3.5 bg-[#131d25] border border-white/10 rounded-xl flex items-center justify-between gap-3"
                      style={{ borderLeftWidth: 4, borderLeftColor: ad.accentColor }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{ad.title}</div>
                        <div className="text-xs text-slate-300">{ad.subtitle}</div>
                        <div className="text-[11px] text-sky-300 mt-0.5">
                          By {ad.ownerName} {ad.instagramHandle ? `· @${ad.instagramHandle}` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ACTIVE ENTERABLE BUILDINGS SERVICE PANEL (All 12 Valley Hubs!)  */}
          {/* =============================================================== */}
          {activePanel === 'building' && (() => {
            const bldg =
              ACTIVE_BUILDINGS.find((b) => b.id === activeBuildingId) || ACTIVE_BUILDINGS[0];

            return (
              <div className="space-y-5">
                {/* Building Quick Switcher */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {ACTIVE_BUILDINGS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openBuildingPanel(b.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border cursor-pointer shrink-0 ${
                        b.id === bldg.id
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-[#131d25] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {b.name.replace('Green Valley ', '').replace('Royal Valley ', '')}
                    </button>
                  ))}
                </div>

                {/* Selected Building Hero */}
                <div className="p-4 bg-[#131d25] border border-white/12 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: bldg.accent }}
                      />
                      <h3 className="font-display text-base font-bold text-white">{bldg.name}</h3>
                    </div>
                    <p className="text-xs text-emerald-300 font-medium">{bldg.subtitle}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{bldg.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => teleportTo(bldg.doorPosition.x, bldg.doorPosition.z + 3, bldg.name)}
                    className="px-3.5 py-2 bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Go to Entrance
                  </button>
                </div>

                {/* Interactive Building Services */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-300">
                    Available Inside {bldg.name}
                  </h4>
                  {bldg.services.map((svc) => {
                    const effectiveCost = isAdmin ? 0 : svc.cost;
                    const cantAfford = effectiveCost > 0 && profile.greenCoins < effectiveCost;
                    return (
                      <div
                        key={svc.id}
                        className="p-4 bg-[#101820] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-white">{svc.label}</div>
                          <div className="text-xs text-slate-300">{svc.description}</div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-mono-nums">
                            {svc.healthRestore && (
                              <span className="text-emerald-400">+{svc.healthRestore} HP</span>
                            )}
                            {svc.rewardCoins && (
                              <span className="text-amber-300">+{svc.rewardCoins} GC</span>
                            )}
                            {svc.rewardXp && <span className="text-sky-300">+{svc.rewardXp} XP</span>}
                            {svc.teleportLabel && (
                              <span className="text-sky-300">→ {svc.teleportLabel}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={cantAfford}
                          onClick={() => multiplayer.useBuildingService(bldg.id, svc.id)}
                          className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 ${
                            svc.rewardCoins
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {svc.openPanel
                            ? 'Open'
                            : effectiveCost > 0
                              ? `Use (${effectiveCost} GC)`
                              : svc.rewardCoins
                                ? `Claim +${svc.rewardCoins} GC`
                                : 'Use Free'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* PLAYER SHOPS STUDIO (Tea Stall / Chaya Kada, Juice Bar, etc.)   */}
          {/* =============================================================== */}
          {activePanel === 'shops' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#0a1015] p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setShopsTab('open')}
                  className={`py-2 text-xs font-semibold rounded-md cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    shopsTab === 'open' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  Start Your Own Shop
                </button>
                <button
                  type="button"
                  onClick={() => setShopsTab('browse')}
                  className={`py-2 text-xs font-semibold rounded-md cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    shopsTab === 'browse' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Open Citizen Shops ({Object.keys(customShops).length})
                </button>
              </div>

              {shopsTab === 'open' && (() => {
                const selectedPlan =
                  CUSTOM_SHOP_PLANS.find((p) => p.shopType === shopType) || CUSTOM_SHOP_PLANS[0];
                const totalShopPrice = computeShopTotalPrice(selectedPlan.price, shopSizeTier, {
                  hasSeating: shopHasSeating,
                  hasAc: shopHasAc,
                });
                const shopRoadCheck = isPositionOnRoad(shopPos.x, shopPos.z, 9);
                const canAffordShop = isAdmin || profile.greenCoins >= totalShopPrice;

                return (
                  <form
                    onSubmit={handleOpenCustomShop}
                    className="p-4 bg-[#131d25] border border-white/10 rounded-xl space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CUSTOM_SHOP_PLANS.map((plan) => (
                        <button
                          key={plan.shopType}
                          type="button"
                          onClick={() => {
                            setShopType(plan.shopType);
                            setShopAwning(plan.defaultAwning);
                          }}
                          className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                            shopType === plan.shopType
                              ? 'bg-rose-600/20 border-rose-400'
                              : 'bg-[#0a1015] border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{plan.label}</span>
                            <span className="text-xs font-mono-nums font-bold text-amber-300 shrink-0">
                              {isAdmin ? 'FREE' : `From ${plan.price} GC`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{plan.description}</p>
                        </button>
                      ))}
                    </div>

                    {/* Tiered Size Selector (Small / Medium / Large / Palace) */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-400 block">
                        Shop Size Tier (Larger sizes increase cost &amp; 3D scale)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SHOP_SIZE_TIERS.map((t) => (
                          <button
                            key={t.tier}
                            type="button"
                            onClick={() => setShopSizeTier(t.tier)}
                            className={`p-2 rounded-lg border text-left cursor-pointer ${
                              shopSizeTier === t.tier
                                ? 'bg-rose-600/20 border-rose-400 text-white'
                                : 'bg-[#0a1015] border-white/10 text-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold">{t.label}</div>
                            <div className="text-[10px] text-amber-300 font-mono-nums">
                              {t.priceMultiplier}x base
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Facilities */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shopHasSeating}
                          onChange={(e) => setShopHasSeating(e.target.checked)}
                          className="accent-rose-500"
                        />
                        Outdoor Seating (+220 GC)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shopHasAc}
                          onChange={(e) => setShopHasAc(e.target.checked)}
                          className="accent-rose-500"
                        />
                        Air Conditioning (+300 GC)
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 block">Your Shop Signboard Name</label>
                        <input
                          type="text"
                          required
                          maxLength={32}
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          placeholder="e.g. Kochi Chaya Kada"
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-rose-400 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 block">
                          Secret Owner Key (Only You Enter Inside)
                        </label>
                        <input
                          type="password"
                          required
                          minLength={4}
                          maxLength={24}
                          value={shopOwnerKey}
                          onChange={(e) => setShopOwnerKey(e.target.value)}
                          placeholder="Set 4+ char private shop key..."
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-amber-400 rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Interactive Off-Road Plot Selector */}
                    <PositionSelector
                      x={shopPos.x}
                      z={shopPos.z}
                      clearance={9}
                      label="Shop Position Viewer & Selector (No Roads Allowed)"
                      onChange={(nx, nz) => setShopPos({ x: nx, z: nz })}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Awning:</span>
                        {['#e11d48', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'].map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setShopAwning(hex)}
                            style={{ backgroundColor: hex }}
                            className={`w-6 h-6 rounded-full cursor-pointer ${
                              shopAwning === hex ? 'ring-2 ring-white scale-110' : 'border border-white/25'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        type="submit"
                        disabled={shopRoadCheck.onRoad || !canAffordShop}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-45 text-white text-xs font-bold rounded-lg cursor-pointer font-mono-nums"
                      >
                        {shopRoadCheck.onRoad
                          ? 'Move Off Road First'
                          : isAdmin
                            ? 'Open 3D Shop (FREE)'
                            : `Open 3D Shop (${totalShopPrice.toLocaleString()} GC)`}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {shopsTab === 'browse' && (
                <div className="space-y-2.5">
                  {Object.keys(customShops).length === 0 ? (
                    <div className="p-6 bg-[#131d25] border border-white/10 rounded-xl text-center space-y-1.5">
                      <p className="text-sm font-semibold text-white">No citizen shops opened yet!</p>
                      <p className="text-xs text-slate-400">
                        Be the first to open a Kerala Tea Stall (Chaya Kada) or Juice Bar in Green Valley.
                      </p>
                    </div>
                  ) : (
                    Object.values(customShops).map((sh) => {
                      const plan =
                        CUSTOM_SHOP_PLANS.find((p) => p.shopType === sh.shopType) || CUSTOM_SHOP_PLANS[0];
                      const canDelete = isAdmin || sh.ownerUid === profile.uid;
                      return (
                        <div
                          key={sh.shopId}
                          className="p-4 bg-[#131d25] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-bold text-white">{sh.name}</div>
                            <div className="text-xs text-slate-300">
                              {plan.label} · Owner: {sh.ownerName}
                              {sh.ownerInstagram ? ` (@${sh.ownerInstagram})` : ''}
                            </div>
                            <div className="text-[11px] text-emerald-400 font-mono-nums mt-0.5">
                              Total Orders Served: {sh.totalSales}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openPlayerShopPanel(sh.shopId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              Order Menu
                            </button>
                            <button
                              type="button"
                              onClick={() => teleportTo(sh.x, sh.z + 3.5, sh.name)}
                              className="px-3 py-1.5 bg-white/8 hover:bg-white/15 text-slate-200 text-xs rounded-lg cursor-pointer"
                            >
                              Visit
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => multiplayer.deleteCustomShop(sh.shopId)}
                                className="p-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 rounded-lg cursor-pointer"
                                aria-label="Close shop"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* CUSTOMER COUNTER FOR A PLAYER-OPENED SHOP (Tea Stall Menu!)     */}
          {/* =============================================================== */}
          {activePanel === 'player_shop' && (() => {
            const shop = activeCustomShopId ? customShops[activeCustomShopId] : null;
            if (!shop) {
              return (
                <p className="text-xs text-slate-400">
                  This shop is currently closed. Open the Shops menu to browse all open stalls!
                </p>
              );
            }
            const plan =
              CUSTOM_SHOP_PLANS.find((p) => p.shopType === shop.shopType) || CUSTOM_SHOP_PLANS[0];
            const isShopOwner = shop.ownerUid === profile.uid || isAdmin;
            const interiorUnlocked = unlockedShopIds.includes(shop.shopId);

            return (
              <div className="space-y-4">
                <div className="p-4 bg-[#131d25] border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">{shop.name}</h3>
                    <p className="text-xs text-amber-300">
                      {plan.label} ({shop.sizeTier || 'small'}) · Operated by {shop.ownerName}
                      {shop.ownerInstagram ? ` (@${shop.ownerInstagram})` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Items visibly appear in your hand to drink/eat! Total orders: {shop.totalSales}
                    </p>
                  </div>
                  <Coffee className="w-8 h-8 text-amber-400 shrink-0" />
                </div>

                {/* Owner Inside-Shop Secret Key Access & Change Key */}
                {isShopOwner && (
                  <div className="p-4 bg-[#0d161d] border border-sky-400/35 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      {interiorUnlocked ? <KeyRound className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4" />}
                      <span>
                        {interiorUnlocked
                          ? 'Inside Shop Counter Unlocked — Manage Owner Secret Key'
                          : 'Owner Private Interior Access — Enter Your Secret Shop Key'}
                      </span>
                    </div>
                    {!interiorUnlocked ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          multiplayer.unlockShopInterior(shop.shopId, shopUnlockInput);
                          setShopUnlockInput('');
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="password"
                          value={shopUnlockInput}
                          onChange={(e) => setShopUnlockInput(e.target.value)}
                          placeholder="Enter owner secret key..."
                          className="flex-1 px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Enter Inside
                        </button>
                      </form>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (shopChangeKeyInput.trim().length < 4) return;
                          multiplayer.changeShopKey(shop.shopId, shopChangeKeyInput.trim());
                          setShopChangeKeyInput('');
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="password"
                          minLength={4}
                          maxLength={24}
                          value={shopChangeKeyInput}
                          onChange={(e) => setShopChangeKeyInput(e.target.value)}
                          placeholder="New 4+ char secret shop key..."
                          className="flex-1 px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Change Key
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5">
                  {plan.menuItems.map((item) => {
                    const effectivePrice = isAdmin ? 0 : item.price;
                    return (
                      <div
                        key={item.id}
                        className="p-4 bg-[#101820] border border-white/10 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{item.name}</div>
                          <div className="text-xs text-slate-400 font-mono-nums">
                            +{item.healthRestore} HP · +{item.xp} XP
                            {item.heldItem && item.heldItem !== 'none' ? ' · Hold & Enjoy in Hand' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={effectivePrice > 0 && profile.greenCoins < effectivePrice}
                          onClick={() => multiplayer.buyFromCustomShop(shop.shopId, item.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold rounded-lg cursor-pointer font-mono-nums"
                        >
                          {effectivePrice === 0 ? 'Order Free' : `Buy · ${effectivePrice} GC`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* FREE SINGLE-TO-MINGLE · ALL JOINED ACCOUNTS · AUTO-SELECT 2 · DP REVEAL · FREE HONEYMOON */}
          {/* =============================================================== */}
          {activePanel === 'mingle' && (() => {
            const remMs = Math.max(0, mingleEvent.nextEventAtMs - nowMs);
            const mins = Math.floor(remMs / 60000);
            const secs = Math.floor((remMs % 60000) / 1000);
            const match = mingleEvent.activeMatch;
            const selectedPair = mingleEvent.selectedPair || null;

            // Build live list of ALL joined accounts on screen (server-authoritative with local fallback)
            const selfParticipant = {
              uid: profile.uid,
              displayName: profile.displayName,
              instagramId: profile.instagramId,
              photoURL: profile.photoURL,
              age: profile.age,
              gender: profile.appearance.gender,
              relationshipStatus: profile.relationshipStatus,
              appearance: profile.appearance,
              joinedAt: nowMs,
              isOnline: true,
              isNpc: false,
            };
            const joinedAccounts =
              mingleEvent.joinedAccounts && mingleEvent.joinedAccounts.length > 0
                ? mingleEvent.joinedAccounts
                : [
                    selfParticipant,
                    ...Object.values(remotePlayers).map((rp) => ({
                      uid: rp.uid,
                      displayName: rp.displayName,
                      instagramId: rp.instagramId,
                      photoURL: rp.photoURL,
                      age: rp.age || 22,
                      gender: rp.appearance.gender,
                      relationshipStatus: rp.relationshipStatus || ('single' as const),
                      appearance: rp.appearance,
                      joinedAt: nowMs,
                      isOnline: true,
                      isNpc: false,
                    })),
                  ];

            const isJoined =
              mingleEvent.isJoined !== undefined
                ? mingleEvent.isJoined
                : joinedAccounts.some((p) => p.uid === profile.uid);

            const isSelectedMember = Boolean(
              selectedPair &&
                (selectedPair.memberA.uid === profile.uid || selectedPair.memberB.uid === profile.uid),
            );

            const handleRunAutoSelect = () => {
              if (autoSelectingMingle) return;
              setAutoSelectingMingle(true);
              const count = Math.max(1, joinedAccounts.length);
              let tick = 0;
              const timer = window.setInterval(() => {
                setRouletteHighlightIdx(tick % count);
                tick += 1;
                if (tick >= Math.max(8, count * 2)) {
                  window.clearInterval(timer);
                  setRouletteHighlightIdx(null);
                  setAutoSelectingMingle(false);
                  multiplayer.autoSelectMingleCouple();
                }
              }, 110);
            };

            return (
              <div className="space-y-5">
                {/* 1. Free Status + Hourly Countdown Header */}
                <div className="p-4 bg-gradient-to-br from-rose-950/60 via-[#15121d] to-[#101820] border border-rose-500/35 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatarDP
                        displayName={profile.displayName}
                        photoURL={profile.photoURL}
                        appearance={profile.appearance}
                        size="md"
                        ringClassName="ring-2 ring-rose-400/70"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 rounded">
                            100% FREE · No Money · Free Honeymoon
                          </span>
                          <span className="text-[11px] text-rose-200">
                            Age {profile.age} · {profile.appearance.gender === 'female' ? 'Woman' : 'Man'}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-white capitalize truncate mt-0.5">
                          {profile.displayName} · Status: {profile.relationshipStatus}
                          {profile.relationshipStatus === 'married' && profile.partnerName
                            ? ` ♥ ${profile.partnerName}`
                            : ''}
                        </h3>
                      </div>
                    </div>
                    <div className="text-right bg-[#0b1014]/80 border border-white/10 rounded-lg px-3.5 py-2 shrink-0">
                      <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-rose-400" />
                        Max 5-Min Auto-Select
                      </div>
                      <div className="font-mono-nums text-xl font-extrabold text-rose-300">
                        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                    <span className="text-slate-200 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      Venue: <strong className="text-white">{mingleEvent.locationName}</strong>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => (isJoined ? multiplayer.leaveMingle() : multiplayer.joinMingle())}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                          isJoined
                            ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-200 hover:bg-emerald-600/35'
                            : 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white'
                        }`}
                      >
                        {isJoined ? 'Joined Screen ✓ (Free)' : 'Join Single-to-Mingle (Free)'}
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => multiplayer.adminResetMingleTimer()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600/25 hover:bg-amber-600/40 border border-amber-400/45 text-amber-200 font-semibold rounded-lg cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset 5m Timer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          teleportTo(
                            mingleEvent.locationPos.x,
                            mingleEvent.locationPos.z,
                            mingleEvent.locationName,
                          )
                        }
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg cursor-pointer"
                      >
                        Go to Venue (Free)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. ALL JOINED ACCOUNTS ON SCREEN + AUTO-SELECT 2 ACCOUNTS BUTTON */}
                <div className="p-4 bg-[#121a22] border border-white/12 rounded-xl space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Users className="w-4 h-4 text-rose-400" />
                        All Joined in Single-to-Mingle ({joinedAccounts.length} Live{' '}
                        {joinedAccounts.length === 1 ? 'Account' : 'Accounts'})
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Auto-selects 2 accounts directly from this screen for FREE — no money needed.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={autoSelectingMingle}
                      onClick={handleRunAutoSelect}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-60 text-white text-xs font-extrabold rounded-lg cursor-pointer shadow-lg shadow-rose-950/50"
                    >
                      <Sparkles className={`w-4 h-4 ${autoSelectingMingle ? 'animate-spin' : ''}`} />
                      {autoSelectingMingle
                        ? 'Selecting 2 Accounts...'
                        : 'Auto-Select 2 Accounts (FREE)'}
                    </button>
                  </div>

                  {/* Live Grid of All Joined Accounts with their DPs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {joinedAccounts.map((member, idx) => {
                      const isRouletteActive = rouletteHighlightIdx === idx;
                      const isPicked =
                        Boolean(selectedPair) &&
                        (selectedPair?.memberA.uid === member.uid ||
                          selectedPair?.memberB.uid === member.uid);
                      return (
                        <div
                          key={member.uid}
                          className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                            isRouletteActive
                              ? 'bg-amber-500/25 border-amber-400 scale-[1.02]'
                              : isPicked
                                ? 'bg-rose-950/60 border-rose-400 ring-1 ring-rose-400/50'
                                : 'bg-[#0b1014] border-white/10'
                          }`}
                        >
                          <PlayerAvatarDP
                            displayName={member.displayName}
                            photoURL={member.photoURL}
                            appearance={member.appearance}
                            gender={member.gender}
                            size="sm"
                            ringClassName={
                              isPicked
                                ? 'ring-2 ring-rose-400'
                                : isRouletteActive
                                  ? 'ring-2 ring-amber-400'
                                  : 'ring-1 ring-white/20'
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">
                                {member.displayName}
                              </span>
                              {member.uid === profile.uid && (
                                <span className="text-[9px] font-bold uppercase text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                              {isPicked && (
                                <span className="text-[9px] font-bold uppercase text-rose-200 bg-rose-500/35 px-1.5 py-0.5 rounded">
                                  Selected ♥
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {member.instagramId ? `@${member.instagramId} · ` : ''}
                              Age {member.age} · {member.gender === 'female' ? 'Girl' : 'Boy'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {joinedAccounts.length < 2 && (
                    <div className="text-[11px] text-amber-200/90 bg-amber-950/35 border border-amber-400/25 rounded-lg px-3 py-2">
                      1 real account is currently online. When 2 or more players join Green Valley,
                      Auto-Select pairs 2 live accounts directly from this screen (when playing solo,
                      it pairs you with a Valley Partner for free!).
                    </div>
                  )}
                </div>

                {/* 3. AFTER SELECT: BIG DP REVEAL OF BOTH SELECTED MEMBERS */}
                {selectedPair && (
                  <div className="p-5 bg-gradient-to-b from-[#23101d] via-[#170e19] to-[#11161f] border-2 border-rose-400/60 rounded-2xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                        {selectedPair.status === 'honeymoon'
                          ? 'Selected Couple · Free Lakeside Honeymoon ♥'
                          : selectedPair.status === 'married'
                            ? 'Selected Couple · Married at Wedding Mandapam ♥'
                            : 'Auto-Selected 2 Members — Profile DPs Revealed!'}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 rounded">
                        FREE · 0 GC
                      </span>
                    </div>

                    {/* Side-by-Side Large DP Cards of the 2 Selected Members */}
                    <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-3 py-2">
                      {/* Member 1 DP */}
                      <div className="sm:col-span-5 p-4 bg-[#0b1014]/85 border border-rose-400/35 rounded-xl flex flex-col items-center text-center gap-2">
                        <PlayerAvatarDP
                          displayName={selectedPair.memberA.displayName}
                          photoURL={selectedPair.memberA.photoURL}
                          appearance={selectedPair.memberA.appearance}
                          gender={selectedPair.memberA.gender}
                          size="xl"
                          ringClassName="ring-4 ring-rose-400/80 shadow-xl shadow-rose-950/60"
                        />
                        <div className="space-y-0.5">
                          <div className="font-display text-base font-extrabold text-white">
                            {selectedPair.memberA.displayName}
                            {selectedPair.memberA.uid === profile.uid ? ' (You)' : ''}
                          </div>
                          {selectedPair.memberA.instagramId && (
                            <div className="text-xs text-sky-300 font-medium">
                              @{selectedPair.memberA.instagramId}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Age {selectedPair.memberA.age} ·{' '}
                            {selectedPair.memberA.gender === 'female' ? 'Woman' : 'Man'}
                          </div>
                          {selectedPair.memberAAccepted && (
                            <div className="text-[10px] font-bold text-emerald-300">
                              ✓ Said YES
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Center Heart Divider */}
                      <div className="sm:col-span-1 flex flex-col items-center justify-center py-1">
                        <div className="w-11 h-11 rounded-full bg-rose-600/30 border border-rose-400/60 flex items-center justify-center">
                          <Heart className="w-5 h-5 text-rose-400 fill-rose-400 animate-pulse" />
                        </div>
                      </div>

                      {/* Member 2 DP */}
                      <div className="sm:col-span-5 p-4 bg-[#0b1014]/85 border border-pink-400/35 rounded-xl flex flex-col items-center text-center gap-2">
                        <PlayerAvatarDP
                          displayName={selectedPair.memberB.displayName}
                          photoURL={selectedPair.memberB.photoURL}
                          appearance={selectedPair.memberB.appearance}
                          gender={selectedPair.memberB.gender}
                          size="xl"
                          ringClassName="ring-4 ring-pink-400/80 shadow-xl shadow-pink-950/60"
                        />
                        <div className="space-y-0.5">
                          <div className="font-display text-base font-extrabold text-white">
                            {selectedPair.memberB.displayName}
                            {selectedPair.memberB.uid === profile.uid ? ' (You)' : ''}
                          </div>
                          {selectedPair.memberB.instagramId && (
                            <div className="text-xs text-sky-300 font-medium">
                              @{selectedPair.memberB.instagramId}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Age {selectedPair.memberB.age} ·{' '}
                            {selectedPair.memberB.gender === 'female' ? 'Woman' : 'Man'}
                          </div>
                          {selectedPair.memberBAccepted && (
                            <div className="text-[10px] font-bold text-emerald-300">
                              ✓ Said YES
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accept / Decline Buttons for the 2 Selected Members (100% FREE) */}
                    {isSelectedMember && match && match.status === 'proposed' && (
                      <div className="space-y-2 pt-1">
                        {match.myAccepted && !match.partnerAccepted ? (
                          <div className="text-center text-xs text-amber-200 bg-amber-950/40 border border-amber-400/35 rounded-xl py-3 px-4 font-semibold">
                            You said YES! Waiting for {match.partnerName} to accept for your FREE Marriage &amp; Honeymoon...
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => multiplayer.respondMingle(true)}
                              className="py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl cursor-pointer"
                            >
                              Yes! Mingle &amp; Marry (FREE)
                            </button>
                            <button
                              type="button"
                              onClick={() => multiplayer.respondMingle(false)}
                              className="py-3 bg-white/8 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                            >
                              Stay Single
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Spectator Info if Another Couple Was Selected */}
                    {!isSelectedMember && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b1014]/70 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-300">
                        <span>
                          Celebrating{' '}
                          <strong className="text-white">{selectedPair.memberA.displayName}</strong>{' '}
                          ♥{' '}
                          <strong className="text-white">{selectedPair.memberB.displayName}</strong>!
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            teleportTo(
                              selectedPair.locationPos.x,
                              selectedPair.locationPos.z,
                              selectedPair.locationName,
                            )
                          }
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg cursor-pointer"
                        >
                          Visit Ceremony (Free)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. FREE MARRIAGE FEAST & FREE LAKESIDE HONEYMOON (No Money Required!) */}
                {match && (match.status === 'married' || match.status === 'honeymoon') && (
                  <div className="space-y-4">
                    {/* Free Grand Wedding Feast (Food Menu) */}
                    <div className="p-4 bg-[#131d25] border border-white/10 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                          <Utensils className="w-4 h-4 text-amber-400" />
                          Grand Wedding Feast Menu (FREE)
                        </div>
                        <button
                          type="button"
                          onClick={() => multiplayer.serveWeddingFeast()}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-lg cursor-pointer"
                        >
                          {match.feastServed
                            ? 'Serve Free Feast Again (+100 HP)'
                            : 'Serve Grand Feast FREE (+100 HP · +120 XP)'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {WEDDING_FEAST_MENU.map((dish) => (
                          <div
                            key={dish.id}
                            className="p-2.5 bg-[#0b1014] border border-white/8 rounded-lg"
                          >
                            <div className="text-xs font-bold text-white">
                              {dish.emoji} {dish.name}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{dish.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 100% FREE Honeymoon Departure */}
                    <div className="p-4 bg-[#19111c] border border-pink-500/35 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-white">
                          Lakeside Honeymoon Resort Suite
                          <span className="text-[10px] font-extrabold uppercase text-emerald-300 bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 rounded">
                            100% FREE
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Teleports you &amp; {match.partnerName} to the lantern-lit Lakeside Honeymoon
                          Resort at Golden Hour — completely FREE (0 GC)!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          multiplayer.startHoneymoon();
                          setActivePanel(null);
                        }}
                        className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-extrabold rounded-xl cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Start Free Honeymoon ♥
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* WORKS & REWARDS PANEL                                           */}
          {/* =============================================================== */}
          {activePanel === 'works' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#0a1015] p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setWorksTab('jobs')}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    worksTab === 'jobs' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Repeatable Works ({WORK_JOBS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWorksTab('rewards')}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    worksTab === 'rewards' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  Rewards & Bonuses ({REWARDS.length})
                </button>
              </div>

              {worksTab === 'jobs' &&
                WORK_JOBS.map((job) => {
                  const readyAt = workCooldowns[job.id] || 0;
                  const secsLeft = Math.max(0, Math.ceil((readyAt - nowMs) / 1000));
                  const isActive = activeWorkShift?.jobId === job.id;
                  const distM = Math.round(
                    Math.hypot(localPos.x - job.target.x, localPos.z - job.target.z),
                  );

                  return (
                    <div
                      key={job.id}
                      className="p-4 bg-[#131d25] border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="text-sky-300 font-medium">{job.role}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-nums text-emerald-400 font-semibold">
                            +{job.payout} GC
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-nums text-sky-400">+{job.xp} XP</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-nums">{distM}m away</span>
                        </div>
                        <h3 className="font-display text-base font-bold text-white">{job.title}</h3>
                        <p className="text-xs text-slate-300">{job.description}</p>
                        <p className="text-[11px] text-emerald-300/90">
                          Destination: {job.targetName} (press E on arrival)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={secsLeft > 0}
                          onClick={() => {
                            setActiveWorkShift({
                              jobId: job.id,
                              title: job.title,
                              target: job.target,
                              targetName: job.targetName,
                              payout: job.payout,
                              xp: job.xp,
                              startedAt: Date.now(),
                            });
                            pushToast(
                              `Work Started: ${job.title}`,
                              `Travel to ${job.targetName} and press E to collect +${job.payout} GC`,
                              'emerald',
                            );
                            setActivePanel(null);
                          }}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap font-mono-nums disabled:opacity-50 ${
                            isActive
                              ? 'bg-emerald-700/40 border border-emerald-400 text-emerald-200'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {secsLeft > 0
                            ? `Ready in ${secsLeft}s`
                            : isActive
                              ? 'Active Shift'
                              : 'Start Work'}
                        </button>
                      </div>
                    </div>
                  );
                })}

              {worksTab === 'rewards' &&
                REWARDS.map((rew) => {
                  const isRepeatable = Boolean(rew.repeatableSec);
                  const claimed = !isRepeatable && profile.claimedRewards.includes(rew.id);
                  const secsLeft = isRepeatable
                    ? Math.max(0, Math.ceil((dailyRewardReadyAt - nowMs) / 1000))
                    : 0;

                  return (
                    <div
                      key={rew.id}
                      className="p-4 bg-[#131d25] border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono-nums text-amber-300 font-semibold">
                            +{rew.coins} GC
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-nums text-sky-400">+{rew.xp} XP</span>
                          {claimed && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-400 font-medium">Claimed</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-base font-bold text-white">{rew.title}</h3>
                        <p className="text-xs text-slate-300">{rew.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={claimed || secsLeft > 0}
                        onClick={() => multiplayer.claimReward(rew.id)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap font-mono-nums shrink-0"
                      >
                        {claimed
                          ? 'Claimed'
                          : secsLeft > 0
                            ? `Ready in ${secsLeft}s`
                            : `Claim +${rew.coins} GC`}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}

          {/* =============================================================== */}
          {/* MISSIONS PANEL                                                  */}
          {/* =============================================================== */}
          {activePanel === 'missions' &&
            MISSIONS.map((m) => {
              const done = profile.completedMissions.includes(m.id);
              const isActive = activeMissionId === m.id;
              return (
                <div
                  key={m.id}
                  className="p-4 bg-[#131d25] border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="capitalize">{m.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-nums text-emerald-400">+{m.rewardCoins} GC</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-nums text-sky-400">+{m.rewardXp} XP</span>
                      {done && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-300 font-medium">Completed</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-white">{m.title}</h3>
                    <p className="text-xs text-slate-300">{m.description}</p>
                    <p className="text-[11px] text-amber-300/90">Objective: {m.objectiveText}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!done && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWorkShift(null);
                          setWaypointTarget(null);
                          setActiveMissionId(m.id);
                          pushToast('Waypoint Set', `Follow golden beacon to ${m.targetName}`, 'amber');
                          setActivePanel(null);
                        }}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-amber-600/30 border border-amber-400 text-amber-200'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isActive ? 'Tracking' : 'Track Mission'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => teleportTo(m.target.x + 3, m.target.z + 3, m.targetName)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-200 bg-white/8 hover:bg-white/14 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Visit
                    </button>
                  </div>
                </div>
              );
            })}

          {/* =============================================================== */}
          {/* PROPERTIES & CUSTOM 3D HOME BUILDER PANEL                       */}
          {/* =============================================================== */}
          {activePanel === 'properties' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#0a1015] p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setHomesTab('build')}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    homesTab === 'build' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  Build Custom 3D Home
                </button>
                <button
                  type="button"
                  onClick={() => setHomesTab('estates')}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    homesTab === 'estates' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Valley Estates ({PROPERTIES.length})
                </button>
              </div>

              {homesTab === 'build' && (() => {
                const totalHomePrice = computeHouseTotalPrice(homeStyle, {
                  hasPool: homePool,
                  hasGarden: homeHasGarden,
                  hasAc: homeHasAc,
                });
                const homeRoadCheck = isPositionOnRoad(homePos.x, homePos.z, 13);
                const canAfford = isAdmin || profile.greenCoins >= totalHomePrice;

                return (
                  <div className="space-y-5">
                    {/* Quick Showcase of Hashim's Villa & Rifad's Villa */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {PALACE_VILLAS.map((pv) => {
                        const live = palaceVillas[pv.villaId] || pv;
                        return (
                          <button
                            key={pv.villaId}
                            type="button"
                            onClick={() => openVillaPanel(pv.villaId)}
                            className="p-3 bg-gradient-to-r from-amber-950/45 to-[#131d25] border border-amber-400/35 hover:border-amber-300 rounded-xl flex items-center justify-between gap-2 text-left cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">{live.boardName}</span>
                              </div>
                              <div className="text-[10px] text-amber-200/90 truncate">
                                @{live.ownerUsername} · Visit {live.visitFee} GC · Key Inside
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-amber-300 shrink-0">Open →</span>
                          </button>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={handleBuildPlayerHome}
                      className="p-4 bg-[#131d25] border border-white/10 rounded-lg space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-sm font-bold text-white">
                          Design &amp; Construct Your Own Home
                        </h3>
                        <span
                          className={`text-xs font-mono-nums font-semibold ${
                            isAdmin ? 'text-amber-300' : 'text-emerald-400'
                          }`}
                        >
                          {isAdmin
                            ? 'FREE (Admin Access)'
                            : `Total: ${totalHomePrice.toLocaleString()} GC`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 block">
                          Clear House Signboard Name
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={32}
                          value={homeName}
                          onChange={(e) => setHomeName(e.target.value)}
                          placeholder={`${profile.displayName}'s Villa`}
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                        />
                      </div>

                      {/* Tiered Home Sizes (Small / Medium / Large / Palace) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {CUSTOM_HOME_PLANS.map((plan) => (
                          <button
                            key={plan.style}
                            type="button"
                            onClick={() => {
                              setHomeStyle(plan.style);
                              setHomePool(plan.defaultPool);
                            }}
                            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              homeStyle === plan.style
                                ? 'bg-emerald-600/20 border-emerald-500 text-white'
                                : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                            }`}
                          >
                            <div className="text-[10px] font-bold uppercase text-sky-300">
                              {plan.tierLabel}
                            </div>
                            <div className="text-xs font-semibold truncate">{plan.label}</div>
                            <div
                              className={`text-[11px] font-mono-nums mt-0.5 ${
                                isAdmin ? 'text-amber-300' : 'text-emerald-400'
                              }`}
                            >
                              {isAdmin ? 'FREE' : `${plan.price.toLocaleString()} GC`}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Interactive Position Viewer & Off-Road Selector */}
                      <PositionSelector
                        x={homePos.x}
                        z={homePos.z}
                        clearance={13}
                        label="House Plot Viewer & Selector (No Roads Allowed)"
                        onChange={(nx, nz) => setHomePos({ x: nx, z: nz })}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-slate-400 block">Wall Color</span>
                          <div className="flex flex-wrap gap-2">
                            {HOME_WALL_COLORS.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                aria-label={`Wall color ${hex}`}
                                onClick={() => setHomeWall(hex)}
                                style={{ backgroundColor: hex }}
                                className={`w-6 h-6 rounded-full cursor-pointer ${
                                  homeWall === hex
                                    ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#131d25]'
                                    : 'border border-white/20'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-slate-400 block">Roof Color</span>
                          <div className="flex flex-wrap gap-2">
                            {HOME_ROOF_COLORS.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                aria-label={`Roof color ${hex}`}
                                onClick={() => setHomeRoof(hex)}
                                style={{ backgroundColor: hex }}
                                className={`w-6 h-6 rounded-full cursor-pointer ${
                                  homeRoof === hex
                                    ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#131d25]'
                                    : 'border border-white/20'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Facilities (Increase price as facilities increase!) */}
                      <div className="flex flex-wrap gap-4 text-xs text-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={homePool}
                            onChange={(e) => setHomePool(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          Swimming Pool (+450 GC)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={homeHasGarden}
                            onChange={(e) => setHomeHasGarden(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          Landscaped Garden (+250 GC)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={homeHasAc}
                            onChange={(e) => setHomeHasAc(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          Central AC (+300 GC)
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <select
                          value={homeInterior}
                          onChange={(e) => setHomeInterior(e.target.value as InteriorTheme)}
                          className="px-2.5 py-1.5 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        >
                          <option value="modern">Modern Interior</option>
                          <option value="cozy">Cozy Interior</option>
                          <option value="minimal">Minimal Interior</option>
                          <option value="luxury">Luxury Interior</option>
                        </select>
                        <select
                          value={homeGarden}
                          onChange={(e) => setHomeGarden(e.target.value as GardenStyle)}
                          className="px-2.5 py-1.5 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        >
                          <option value="flowers">Flower Garden</option>
                          <option value="zen">Zen Garden</option>
                          <option value="poolside">Poolside Patio</option>
                          <option value="orchard">Fruit Orchard</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="submit"
                          disabled={homeRoadCheck.onRoad || !canAfford}
                          className={`w-full py-2.5 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-45 ${
                            isAdmin
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-emerald-600 hover:bg-emerald-500'
                          }`}
                        >
                          {homeRoadCheck.onRoad
                            ? 'Plot Blocked on Road — Pick Green Land'
                            : isAdmin
                              ? 'Construct 3D Home Now (FREE · Admin)'
                              : `Construct 3D Home Now (${totalHomePrice.toLocaleString()} GC)`}
                        </button>
                        {!canAfford && (
                          <div className="flex items-center justify-between text-[11px] text-amber-300">
                            <span>
                              Need {(totalHomePrice - profile.greenCoins).toLocaleString()} more GC to
                              build this home.
                            </span>
                            <button
                              type="button"
                              onClick={() => setActivePanel('works')}
                              className="underline text-sky-300 hover:text-sky-200 cursor-pointer"
                            >
                              Earn in Works
                            </button>
                          </div>
                        )}
                      </div>
                    </form>

                  {/* Directory of Custom Built Homes in Green Valley */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-300">
                      Custom Built Homes in Green Valley ({Object.keys(customHomes).length})
                    </h3>
                    {Object.keys(customHomes).length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 bg-[#131d25] border border-white/10 rounded-lg">
                        No custom homes have been built yet. Construct the very first custom home in
                        Green Valley above!
                      </p>
                    ) : (
                      Object.values(customHomes).map((ch) => (
                        <div
                          key={ch.homeId}
                          className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="capitalize">{ch.style}</span>
                              <span aria-hidden="true">·</span>
                              <span className={ch.createdByAdmin ? 'text-amber-300' : 'text-emerald-300'}>
                                {ch.createdByAdmin ? 'Admin Built' : 'Player Built'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-nums">
                                ({Math.round(ch.x)}, {Math.round(ch.z)})
                              </span>
                            </div>
                            <div className="font-display text-sm font-bold text-white truncate">
                              {ch.name}
                            </div>
                            <div className="text-xs text-slate-300 truncate">
                              Owner: {ch.ownerName}
                              {ch.ownerInstagram ? (
                                <span className="text-sky-300 ml-1.5">@{ch.ownerInstagram}</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => teleportTo(ch.x, ch.z + 11, ch.name)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/8 hover:bg-white/14 text-slate-200 text-xs font-medium rounded-lg cursor-pointer shrink-0"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Visit
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                );
              })()}

              {homesTab === 'estates' &&
                PROPERTIES.map((prop) => {
                  const own = worldProperties[prop.id];
                  const isMine = own && own.ownerUid === firebaseUser?.uid;
                  const ownedByOther = own && own.ownerUid !== firebaseUser?.uid;

                  return (
                    <div
                      key={prop.id}
                      className="p-4 bg-[#131d25] border border-white/10 rounded-lg space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="capitalize">{prop.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-nums text-emerald-400">{prop.price} GC</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                isMine
                                  ? 'text-emerald-300 font-medium'
                                  : ownedByOther
                                    ? 'text-sky-300'
                                    : 'text-slate-300'
                              }
                            >
                              {isMine
                                ? 'Owned by You'
                                : ownedByOther
                                  ? `Owner: ${own.ownerName}`
                                  : 'Available'}
                            </span>
                          </div>
                          <h3 className="font-display text-base font-bold text-white">{prop.name}</h3>
                          <p className="text-xs text-slate-300">{prop.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              teleportTo(prop.doorPosition.x, prop.doorPosition.z + 2, prop.name)
                            }
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-200 bg-white/8 hover:bg-white/14 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Visit
                          </button>
                          {!own && (
                            <button
                              type="button"
                              disabled={!isAdmin && profile.greenCoins < prop.price}
                              onClick={() => multiplayer.buyProperty(prop.id)}
                              className={`px-3.5 py-2 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-45 ${
                                isAdmin
                                  ? 'bg-amber-600 hover:bg-amber-500'
                                  : 'bg-emerald-600 hover:bg-emerald-500'
                              }`}
                            >
                              {isAdmin ? 'Claim Free (Admin)' : `Buy (${prop.price} GC)`}
                            </button>
                          )}
                        </div>
                      </div>

                      {(isMine || isAdmin) && own && (
                        <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1.5">
                            <span className="text-slate-400 block">Interior Theme</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(['modern', 'cozy', 'minimal', 'luxury'] as InteriorTheme[]).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() =>
                                    multiplayer.customizeProperty(
                                      prop.id,
                                      profile.displayName,
                                      t,
                                      own.gardenStyle,
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded capitalize cursor-pointer ${
                                    own.interiorTheme === t
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-slate-400 block">Garden Decor</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(['flowers', 'zen', 'poolside', 'orchard'] as GardenStyle[]).map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() =>
                                    multiplayer.customizeProperty(
                                      prop.id,
                                      profile.displayName,
                                      own.interiorTheme,
                                      g,
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded capitalize cursor-pointer ${
                                    own.gardenStyle === g
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* =============================================================== */}
          {/* BUSINESSES PANEL                                                */}
          {/* =============================================================== */}
          {activePanel === 'businesses' &&
            BUSINESSES.map((biz) => {
              const owned = profile.ownedBusinesses.includes(biz.id);
              const readyAt = businessCooldowns[biz.id] || 0;
              const secsLeft = Math.max(0, Math.ceil((readyAt - nowMs) / 1000));
              return (
                <div
                  key={biz.id}
                  className="p-4 bg-[#131d25] border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="capitalize">{biz.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-nums text-emerald-400">
                        +{biz.payout} GC / {biz.cooldownSec}s
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-white">{biz.name}</h3>
                    <p className="text-xs text-slate-300">{biz.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => teleportTo(biz.position.x, biz.position.z + 9, biz.name)}
                      className="px-3 py-2 text-xs font-medium text-slate-200 bg-white/8 hover:bg-white/14 rounded-lg cursor-pointer"
                    >
                      Visit
                    </button>
                    {owned ? (
                      <button
                        type="button"
                        disabled={secsLeft > 0}
                        onClick={() => multiplayer.collectBusiness(biz.id)}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap font-mono-nums"
                      >
                        {secsLeft > 0 ? `Ready in ${secsLeft}s` : `Collect +${biz.payout} GC`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!isAdmin && profile.greenCoins < biz.price}
                        onClick={() => multiplayer.buyBusiness(biz.id)}
                        className={`px-3.5 py-2 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-45 ${
                          isAdmin
                            ? 'bg-amber-600 hover:bg-amber-500'
                            : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {isAdmin ? 'Acquire Free (Admin)' : `Acquire (${biz.price} GC)`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {/* =============================================================== */}
          {/* VEHICLES PANEL (KSRTC Super Fast Bus + Full Green Valley Fleet) */}
          {/* =============================================================== */}
          {activePanel === 'vehicles' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-[#0a1015] border border-red-500/30 rounded-lg text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-300">KSRTC Super Fast Bus &amp; Full Fleet Access:</strong>{' '}
                Drive the iconic Kerala red-and-yellow <strong className="text-white">KSRTC Bus</strong>,
                free bicycles, cars, SUVs, motorcycles &amp; SkyCab Flying Taxi! Spend Green Coins to rent
                or permanently unlock any vehicle right here, or walk up and press{' '}
                <strong className="text-emerald-400">E</strong>.
              </div>
              {Object.values(vehicles)
                .sort((a, b) => (a.kind === 'ksrtc_bus' ? -1 : b.kind === 'ksrtc_bus' ? 1 : 0))
                .map((v) => {
                  const occupied = v.driverUid !== null;
                  const isFree = v.rentPrice <= 0 && v.buyPrice <= 0;
                  const isOwned = profile.ownedVehicles.includes(v.id);
                  const distM = Math.round(Math.hypot(localPos.x - v.x, localPos.z - v.z));
                  const isKsrtc = v.kind === 'ksrtc_bus';

                  return (
                    <div
                      key={v.id}
                      className={`p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                        isKsrtc
                          ? 'bg-gradient-to-r from-red-950/45 to-[#131d25] border-amber-400/40'
                          : 'bg-[#131d25] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className="w-4 h-10 rounded-sm shrink-0 border border-white/20"
                          style={{
                            background: isKsrtc
                              ? 'linear-gradient(180deg, #dc2626 55%, #facc15 55%)'
                              : v.color,
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-sm font-bold text-white">{v.name}</h3>
                            {isKsrtc && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-amber-200 text-[10px] font-extrabold rounded">
                                KSRTC
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className="capitalize">{v.kind.replace('_', ' ')}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-nums">
                              Top {Math.round(v.maxSpeed * 3.6)} km/h
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-nums text-sky-300">{distM}m away</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                occupied
                                  ? 'text-amber-400'
                                  : isAdmin || isFree || isOwned
                                    ? 'text-emerald-400 font-medium'
                                    : 'text-amber-300 font-mono-nums'
                              }
                            >
                              {occupied
                                ? 'In Use'
                                : isAdmin
                                  ? 'Free Access'
                                  : isFree
                                    ? 'Free'
                                    : isOwned
                                      ? 'Owned (Free)'
                                      : `Rent ${v.rentPrice} GC · Buy ${v.buyPrice} GC`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!occupied && (isAdmin || isFree || isOwned) && (
                          <button
                            type="button"
                            onClick={() => {
                              multiplayer.enterVehicle(v.id, 'free');
                              setActivePanel(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Car className="w-3.5 h-3.5" />
                            Drive Now
                          </button>
                        )}
                        {!occupied && !isAdmin && !isFree && !isOwned && (
                          <>
                            <button
                              type="button"
                              disabled={profile.greenCoins < v.rentPrice}
                              onClick={() => {
                                multiplayer.enterVehicle(v.id, 'rent');
                                setActivePanel(null);
                              }}
                              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap font-mono-nums"
                            >
                              Rent ({v.rentPrice} GC)
                            </button>
                            <button
                              type="button"
                              disabled={profile.greenCoins < v.buyPrice}
                              onClick={() => {
                                multiplayer.enterVehicle(v.id, 'buy');
                                setActivePanel(null);
                              }}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap font-mono-nums"
                            >
                              Buy ({v.buyPrice} GC)
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setWaypointTarget({ x: v.x, z: v.z, label: v.name });
                            pushToast(
                              `Waypoint: ${v.name}`,
                              `Walk ${distM}m to the beacon and press E to board.`,
                              'sky',
                            );
                            setActivePanel(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/8 hover:bg-white/15 text-slate-200 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Locate
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* =============================================================== */}
          {/* ADMIN STUDIO PANEL (Verified Admin Only — Same-Page Sign-In)    */}
          {/* =============================================================== */}
          {activePanel === 'admin' && (
            <div className="space-y-4">
              {!isAdmin ? (
                <div className="p-5 bg-[#131d25] border border-white/10 rounded-lg space-y-2">
                  <h3 className="font-display text-base font-bold text-white">
                    Admin Privileges Required
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sign in with the owner Google account on the main Sign In screen to access Admin
                    Studio and free world building.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-1.5 bg-[#0a1015] p-1 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setAdminTab('build')}
                      className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        adminTab === 'build' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Build
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('world')}
                      className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        adminTab === 'world' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      World
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('homes')}
                      className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        adminTab === 'homes' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Homes ({Object.keys(customHomes).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('players')}
                      className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        adminTab === 'players' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Players ({Object.keys(remotePlayers).length + 1})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('followers')}
                      className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        adminTab === 'followers'
                          ? 'bg-pink-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Followers
                    </button>
                  </div>

                  {adminTab === 'world' && (
                    <div className="space-y-4">
                      {/* 1. Expand Village Space */}
                      <div className="p-4 bg-[#131d25] border border-emerald-500/30 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">
                            Expand Green Valley Village Size
                          </h3>
                          <span className="text-xs font-mono-nums font-bold text-emerald-400">
                            {adminVillageSlider * 2}m × {adminVillageSlider * 2}m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={WORLD_HALF_SIZE}
                          max={MAX_WORLD_HALF_SIZE}
                          step={30}
                          value={adminVillageSlider}
                          onChange={(e) => setAdminVillageSlider(Number(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Default: {WORLD_HALF_SIZE * 2}m</span>
                          <span>Max: {MAX_WORLD_HALF_SIZE * 2}m</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => multiplayer.adminExpandVillage(adminVillageSlider)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Apply Expanded Village Space Live
                        </button>
                      </div>

                      {/* 2. Push Typixel Update Alert to All Citizen Phones */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!adminUpdateTitle.trim() || !adminUpdateMsg.trim()) return;
                          multiplayer.adminPublishUpdate(adminUpdateTitle.trim(), adminUpdateMsg.trim());
                          setAdminUpdateTitle('');
                          setAdminUpdateMsg('');
                        }}
                        className="p-4 bg-[#131d25] border border-amber-400/30 rounded-xl space-y-2.5"
                      >
                        <h3 className="text-sm font-bold text-white">
                          Broadcast Typixel Update Alert to All Phones
                        </h3>
                        <input
                          type="text"
                          maxLength={60}
                          value={adminUpdateTitle}
                          onChange={(e) => setAdminUpdateTitle(e.target.value)}
                          placeholder="Alert Title (e.g. New Football Tournament!)"
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                        />
                        <textarea
                          rows={2}
                          maxLength={220}
                          value={adminUpdateMsg}
                          onChange={(e) => setAdminUpdateMsg(e.target.value)}
                          placeholder="Write message pushed directly to every citizen's Typixel Smartphone..."
                          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none resize-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Send Live Phone Alert
                        </button>
                      </form>

                      {/* 3. Expand & Relocate Citizen Shop Space */}
                      <div className="p-4 bg-[#131d25] border border-rose-400/30 rounded-xl space-y-3">
                        <h3 className="text-sm font-bold text-white">
                          Expand Size &amp; Relocate Citizen Shop Space
                        </h3>
                        {Object.keys(customShops).length === 0 ? (
                          <p className="text-xs text-slate-400">No citizen shops open yet.</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <select
                                value={adminShopEditId}
                                onChange={(e) => {
                                  const sid = e.target.value;
                                  setAdminShopEditId(sid);
                                  const sh = customShops[sid];
                                  if (sh) {
                                    setAdminShopEditTier(sh.sizeTier || 'small');
                                    setAdminShopEditPos({ x: sh.x, z: sh.z });
                                  }
                                }}
                                className="px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                              >
                                <option value="">Select shop to expand/move...</option>
                                {Object.values(customShops).map((sh) => (
                                  <option key={sh.shopId} value={sh.shopId}>
                                    {sh.name} ({sh.sizeTier || 'small'})
                                  </option>
                                ))}
                              </select>
                              <select
                                value={adminShopEditTier}
                                onChange={(e) => setAdminShopEditTier(e.target.value as ShopSizeTier)}
                                className="px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                              >
                                {SHOP_SIZE_TIERS.map((t) => (
                                  <option key={t.tier} value={t.tier}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {adminShopEditId && (
                              <>
                                <PositionSelector
                                  x={adminShopEditPos.x}
                                  z={adminShopEditPos.z}
                                  clearance={9}
                                  label="New Shop Location (Off-Road)"
                                  onChange={(nx, nz) => setAdminShopEditPos({ x: nx, z: nz })}
                                />
                                <button
                                  type="button"
                                  disabled={isPositionOnRoad(adminShopEditPos.x, adminShopEditPos.z, 9).onRoad}
                                  onClick={() =>
                                    multiplayer.adminUpdateShopSpace(adminShopEditId, {
                                      x: adminShopEditPos.x,
                                      z: adminShopEditPos.z,
                                      sizeTier: adminShopEditTier,
                                    })
                                  }
                                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-45 text-white text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  Update Shop Size &amp; Position
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* 4. Quick Palace Villa & Mingle Timer Admin Actions */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openVillaPanel('hashim_villa')}
                          className="px-3.5 py-2 bg-amber-600/25 hover:bg-amber-600/40 border border-amber-400/40 text-amber-200 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Manage Hashim&apos;s Villa
                        </button>
                        <button
                          type="button"
                          onClick={() => openVillaPanel('rifad_villa')}
                          className="px-3.5 py-2 bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Manage Rifad&apos;s Villa
                        </button>
                        <button
                          type="button"
                          onClick={() => multiplayer.adminResetMingleTimer()}
                          className="px-3.5 py-2 bg-rose-600/25 hover:bg-rose-600/40 border border-rose-400/40 text-rose-200 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Reset Mingle 5-Min Timer
                        </button>
                      </div>
                    </div>
                  )}

                  {adminTab === 'build' && (
                    <form
                      onSubmit={handleAdminBuildHome}
                      className="p-4 bg-[#131d25] border border-amber-500/25 rounded-lg space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-sm font-bold text-white">
                          Construct Custom 3D Home for Any Player
                        </h3>
                        <span className="text-xs font-semibold text-amber-300">Admin Free Build</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAdminTargetMode('online')}
                          className={`py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                            adminTargetMode === 'online'
                              ? 'bg-amber-600/20 border-amber-400 text-amber-200'
                              : 'bg-[#0a1015] border-white/10 text-slate-300'
                          }`}
                        >
                          Online Player
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminTargetMode('custom')}
                          className={`py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                            adminTargetMode === 'custom'
                              ? 'bg-amber-600/20 border-amber-400 text-amber-200'
                              : 'bg-[#0a1015] border-white/10 text-slate-300'
                          }`}
                        >
                          Any Name / Instagram ID
                        </button>
                      </div>

                      {adminTargetMode === 'online' ? (
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400 block">
                            Select Online Recipient
                          </label>
                          <select
                            value={adminSelectedUid}
                            onChange={(e) => setAdminSelectedUid(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                          >
                            <option value="self">
                              {profile.displayName} (You)
                              {profile.instagramId ? ` · @${profile.instagramId}` : ''}
                            </option>
                            {Object.values(remotePlayers).map((rp) => (
                              <option key={rp.uid} value={rp.uid}>
                                {rp.displayName}
                                {rp.instagramId ? ` · @${rp.instagramId}` : ''} (Lv.{rp.level})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            required
                            maxLength={24}
                            value={adminCustomOwnerName}
                            onChange={(e) => setAdminCustomOwnerName(e.target.value)}
                            placeholder="Resident Name (e.g. Alex)"
                            className="px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                          />
                          <input
                            type="text"
                            maxLength={31}
                            value={adminCustomOwnerInsta}
                            onChange={(e) => setAdminCustomOwnerInsta(e.target.value)}
                            placeholder="@instagram_id (optional)"
                            className="px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      )}

                      <input
                        type="text"
                        maxLength={32}
                        value={adminHomeName}
                        onChange={(e) => setAdminHomeName(e.target.value)}
                        placeholder="Home Signboard Name (e.g. Emerald Palace)"
                        className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                      />

                      <PositionSelector
                        x={adminPos.x}
                        z={adminPos.z}
                        clearance={13}
                        label="Admin Off-Road Plot Selector"
                        onChange={(nx, nz) => setAdminPos({ x: nx, z: nz })}
                      />

                      <div className="grid grid-cols-4 gap-2">
                        {CUSTOM_HOME_PLANS.map((plan) => (
                          <button
                            key={plan.style}
                            type="button"
                            onClick={() => setAdminHomeStyle(plan.style)}
                            className={`p-2 rounded-lg border text-xs font-medium capitalize cursor-pointer ${
                              adminHomeStyle === plan.style
                                ? 'bg-amber-600/20 border-amber-400 text-amber-200'
                                : 'bg-[#0a1015] border-white/10 text-slate-300'
                            }`}
                          >
                            {plan.tierLabel}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">Walls:</span>
                          {HOME_WALL_COLORS.slice(0, 5).map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setAdminWall(hex)}
                              style={{ backgroundColor: hex }}
                              className={`w-5 h-5 rounded-full cursor-pointer ${
                                adminWall === hex ? 'ring-2 ring-amber-400' : 'border border-white/20'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">Roof:</span>
                          {HOME_ROOF_COLORS.slice(0, 5).map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setAdminRoof(hex)}
                              style={{ backgroundColor: hex }}
                              className={`w-5 h-5 rounded-full cursor-pointer ${
                                adminRoof === hex ? 'ring-2 ring-amber-400' : 'border border-white/20'
                              }`}
                            />
                          ))}
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={adminPool}
                            onChange={(e) => setAdminPool(e.target.checked)}
                            className="accent-amber-500"
                          />
                          Pool
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={isPositionOnRoad(adminPos.x, adminPos.z, 13).onRoad}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Spawn 3D Home Live for All Players
                      </button>
                    </form>
                  )}

                  {adminTab === 'homes' && (
                    <div className="space-y-2.5">
                      {Object.keys(customHomes).length === 0 ? (
                        <p className="text-xs text-slate-400 p-4 bg-[#131d25] border border-white/10 rounded-lg">
                          No custom homes placed yet. Use the &ldquo;Build for Anyone&rdquo; tab to
                          construct homes across Green Valley.
                        </p>
                      ) : (
                        Object.values(customHomes).map((ch) => (
                          <div
                            key={ch.homeId}
                            className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">{ch.name}</div>
                              <div className="text-xs text-slate-300 truncate">
                                {ch.ownerName}
                                {ch.ownerInstagram ? ` · @${ch.ownerInstagram}` : ''} ·{' '}
                                <span className="capitalize">{ch.style}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => teleportTo(ch.x, ch.z + 11, ch.name)}
                                className="px-2.5 py-1.5 bg-white/8 hover:bg-white/14 text-slate-200 text-xs rounded-lg cursor-pointer"
                              >
                                Visit
                              </button>
                              <button
                                type="button"
                                onClick={() => multiplayer.adminDeleteHome(ch.homeId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 text-xs rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {adminTab === 'players' && (
                    <div className="space-y-2.5">
                      {[
                        {
                          uid: profile.uid,
                          displayName: `${profile.displayName} (You)`,
                          instagramId: profile.instagramId,
                          level: profile.level,
                        },
                        ...Object.values(remotePlayers),
                      ].map((p) => (
                        <div
                          key={p.uid}
                          className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {p.displayName}
                            </div>
                            <div className="text-xs text-slate-400">
                              Lv.{p.level}
                              {p.instagramId ? (
                                <span className="text-sky-300 ml-2">@{p.instagramId}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => multiplayer.adminGrantCoins(p.uid, 500)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer font-mono-nums"
                            >
                              +500 GC
                            </button>
                            <button
                              type="button"
                              onClick={() => multiplayer.adminGrantCoins(p.uid, 1500)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg cursor-pointer font-mono-nums"
                            >
                              +1,500 GC
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {adminTab === 'followers' && <AdminFollowersTab />}
                </>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* FRIENDS & ONLINE PLAYERS PANEL (Displays Instagram Handles!)    */}
          {/* =============================================================== */}
          {activePanel === 'friends' && (
            <div className="space-y-5">
              {friendRequests.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-amber-300">Incoming Friend Requests</h3>
                  {friendRequests.map((req) => (
                    <div
                      key={req.fromUid}
                      className="p-3.5 bg-[#131d25] border border-amber-500/30 rounded-lg flex items-center justify-between gap-3"
                    >
                      <span className="text-sm font-medium text-white">{req.fromName}</span>
                      <button
                        type="button"
                        onClick={() => multiplayer.acceptFriendRequest(req.fromUid)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-300">
                  Other Players Currently in Green Valley ({Object.keys(remotePlayers).length})
                </h3>
                {Object.keys(remotePlayers).length === 0 ? (
                  <div className="p-6 bg-[#131d25] border border-white/10 rounded-lg text-center space-y-1.5">
                    <p className="text-sm text-slate-200 font-medium">
                      You are the first player in Green Valley right now.
                    </p>
                    <p className="text-xs text-slate-400">
                      Open a second browser window signed into a different Google or Email account
                      to explore, build homes, and chat together in real time.
                    </p>
                  </div>
                ) : (
                  Object.values(remotePlayers).map((rp) => {
                    const isFriend = profile.friends.includes(rp.uid);
                    return (
                      <div
                        key={rp.uid}
                        className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {rp.photoURL ? (
                            <img
                              src={rp.photoURL}
                              alt={rp.displayName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-sky-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                              {rp.displayName[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {rp.displayName}
                              {rp.isAdmin ? (
                                <span className="text-[10px] text-amber-400 font-semibold ml-1.5">
                                  ADMIN
                                </span>
                              ) : null}
                              {(rp.voiceActive || voicePeers[rp.uid]) && (
                                <span className="text-[10px] text-emerald-400 font-semibold ml-1.5">
                                  {voicePeers[rp.uid]?.speaking ? 'TALKING' : 'VOICE'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono-nums truncate">
                              Lv.{rp.level}
                              {rp.instagramId ? (
                                <span className="text-sky-300 ml-1.5">@{rp.instagramId}</span>
                              ) : null}{' '}
                              · {isFriend ? 'Friend' : 'Online'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDirectChatTargetUid(rp.uid);
                              setActivePanel('chat');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/35 text-sky-200 text-xs font-medium rounded-lg cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => teleportTo(rp.x + 2.5, rp.z + 2.5, rp.displayName)}
                            className="px-3 py-1.5 bg-white/8 hover:bg-white/14 text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
                          >
                            Meet Up
                          </button>
                          {!isFriend && (
                            <button
                              type="button"
                              onClick={() => multiplayer.sendFriendRequest(rp.uid)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* INVENTORY & SHOP PANEL                                          */}
          {/* =============================================================== */}
          {activePanel === 'inventory' && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-300">
                  Your Backpack ({profile.inventory.length}/30)
                </h3>
                {profile.inventory.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-[#131d25] border border-white/10 rounded-lg">
                    Your backpack is empty. Purchase supplies or collectibles from the Grand Valley
                    Mall Shop below.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {profile.inventory.map((itemId, idx) => {
                      const item = SHOP_ITEMS.find((i) => i.id === itemId);
                      if (!item) return null;
                      return (
                        <div
                          key={`${itemId}_${idx}`}
                          className="p-3 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">{item.name}</div>
                            <div className="text-[11px] text-slate-400 capitalize">{item.category}</div>
                          </div>
                          {item.healthRestore && (
                            <button
                              type="button"
                              onClick={() => multiplayer.useInventoryItem(item.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded cursor-pointer"
                            >
                              Use (+{item.healthRestore} HP)
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-300">Grand Valley Mall Catalog</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SHOP_ITEMS.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">{item.name}</span>
                          <span
                            className={`text-xs font-mono-nums font-bold ${
                              isAdmin ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            {isAdmin ? 'FREE' : `${item.price} GC`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!isAdmin && profile.greenCoins < item.price}
                        onClick={() => multiplayer.buyShopItem(item.id)}
                        className={`w-full py-2 text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-45 ${
                          isAdmin
                            ? 'bg-amber-600 hover:bg-amber-500'
                            : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {isAdmin ? 'Take Free (Admin)' : `Purchase (${item.price} GC)`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* WALLET & ATM PANEL                                              */}
          {/* =============================================================== */}
          {activePanel === 'wallet' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-[#131d25] border border-white/10 rounded-lg">
                  <div className="text-xs text-slate-400">Green Coins</div>
                  <div className="text-2xl font-display font-bold font-mono-nums text-emerald-400 mt-1">
                    {profile.greenCoins.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-[#131d25] border border-white/10 rounded-lg">
                  <div className="text-xs text-slate-400">Player Level</div>
                  <div className="text-2xl font-display font-bold font-mono-nums text-white mt-1">
                    Lv. {profile.level}
                  </div>
                </div>
                <div className="p-4 bg-[#131d25] border border-white/10 rounded-lg">
                  <div className="text-xs text-slate-400">Homes / Vehicles</div>
                  <div className="text-2xl font-display font-bold font-mono-nums text-sky-400 mt-1">
                    {profile.ownedProperties.length} / {profile.ownedVehicles.length}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-300">Recent Transactions</h3>
                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-[#131d25] border border-white/10 rounded-lg">
                    No transactions recorded yet. Complete works, claim rewards, or build a custom
                    home to build your ledger.
                  </p>
                ) : (
                  <div className="divide-y divide-white/8 bg-[#131d25] border border-white/10 rounded-lg">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="text-white font-medium">{tx.reason}</div>
                          <div className="text-[11px] text-slate-400 font-mono-nums">
                            Balance after: {tx.balanceAfter.toLocaleString()} GC
                          </div>
                        </div>
                        <span
                          className={`font-mono-nums font-bold ${
                            tx.type === 'earn' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.type === 'earn' ? '+' : '-'}
                          {tx.amount.toLocaleString()} GC
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SETTINGS PANEL                                                  */}
          {/* =============================================================== */}
          {activePanel === 'settings' && (
            <div className="space-y-6 text-sm">
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-300">Day & Night Cycle</span>
                <div className="grid grid-cols-5 gap-2">
                  {(
                    [
                      ['cycle', 'Live Cycle'],
                      ['morning', 'Morning'],
                      ['noon', 'Midday'],
                      ['golden', 'Golden Hr'],
                      ['night', 'Night'],
                    ] as [TimeOfDayMode, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTimeOfDayMode(id)}
                      className={`py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                        timeOfDayMode === id
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                          : 'bg-[#131d25] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-300">Weather Effects</span>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['clear', 'Clear Sky'],
                      ['breeze', 'Breeze'],
                      ['rain', 'Light Rain'],
                      ['mist', 'Valley Mist'],
                    ] as [WeatherMode, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWeatherMode(id)}
                      className={`py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                        weatherMode === id
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                          : 'bg-[#131d25] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className="text-slate-200 font-medium">Procedural Sound Effects</span>
                  <span className={audioEnabled ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                    {audioEnabled ? 'Enabled' : 'Muted'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileControls(!showMobileControls)}
                  className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className="text-slate-200 font-medium">On-Screen Touch Controls</span>
                  <span
                    className={
                      showMobileControls ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }
                  >
                    {showMobileControls ? 'Shown' : 'Hidden'}
                  </span>
                </button>
              </div>

              <div className="p-4 bg-[#131d25] border border-white/10 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Controls: WASD Move · SHIFT Run · SPACE Jump · Drag Mouse Orbit · E Interact
                </span>
                <span className="font-mono-nums text-emerald-400 font-semibold shrink-0 ml-3">
                  {fps} FPS
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

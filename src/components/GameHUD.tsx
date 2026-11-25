import { useState } from 'react';
import {
  Briefcase,
  Building2,
  Car,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Heart,
  Home,
  Menu,
  MessageSquare,
  Navigation,
  Package,
  ShieldCheck,
  Smile,
  Users,
  X,
} from 'lucide-react';
import type { EmoteType } from '../shared/types.ts';
import { MISSIONS } from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';
import type { MobileInputState } from './WorldViewport.tsx';
import { Minimap } from './Minimap.tsx';
import { GamePanels } from './GamePanels.tsx';
import { playSfx } from '../game/audio.ts';

interface GameHUDProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  onInteract: () => void;
}

const EMOTES: { id: EmoteType; label: string }[] = [
  { id: 'wave', label: 'Wave' },
  { id: 'dance', label: 'Dance' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'clap', label: 'Clap' },
  { id: 'sit', label: 'Sit' },
];

export function GameHUD({ mobileInputRef, onInteract }: GameHUDProps) {
  const profile = useGameStore((s) => s.profile);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const health = useGameStore((s) => s.health);
  const activeVehicleId = useGameStore((s) => s.activeVehicleId);
  const vehicles = useGameStore((s) => s.vehicles);
  const localSpeedKmh = useGameStore((s) => s.localSpeedKmh);
  const localAltitude = useGameStore((s) => s.localAltitude);
  const localPos = useGameStore((s) => s.localPos);
  const activeMissionId = useGameStore((s) => s.activeMissionId);
  const activeWorkShift = useGameStore((s) => s.activeWorkShift);
  const setActiveWorkShift = useGameStore((s) => s.setActiveWorkShift);
  const waypointTarget = useGameStore((s) => s.waypointTarget);
  const setWaypointTarget = useGameStore((s) => s.setWaypointTarget);
  const nearbyPrompt = useGameStore((s) => s.nearbyPrompt);
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const hudCollapsed = useGameStore((s) => s.hudCollapsed);
  const toggleHudCollapsed = useGameStore((s) => s.toggleHudCollapsed);
  const toasts = useGameStore((s) => s.toasts);
  const triggerEmote = useGameStore((s) => s.triggerEmote);
  const showMobileControls = useGameStore((s) => s.showMobileControls);
  const friendRequests = useGameStore((s) => s.friendRequests);
  const sessionReplacedMessage = useGameStore((s) => s.sessionReplacedMessage);

  const [showEmotes, setShowEmotes] = useState(false);

  if (!profile) return null;

  const activeMission = activeMissionId
    ? MISSIONS.find((m) => m.id === activeMissionId)
    : null;
  const activeVehicle = activeVehicleId ? vehicles[activeVehicleId] : null;

  const togglePanel = (panel: NonNullable<typeof activePanel>) => {
    playSfx('click');
    setShowEmotes(false);
    setActivePanel(activePanel === panel ? null : panel);
  };

  const setMobileMove = (x: number, y: number) => {
    mobileInputRef.current.moveX = x;
    mobileInputRef.current.moveY = y;
  };

  const workDist = activeWorkShift
    ? Math.round(Math.hypot(localPos.x - activeWorkShift.target.x, localPos.z - activeWorkShift.target.z))
    : 0;
  const wpDist = waypointTarget
    ? Math.round(Math.hypot(localPos.x - waypointTarget.x, localPos.z - waypointTarget.z))
    : 0;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Duplicate Session Notice */}
      {sessionReplacedMessage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-md w-full bg-[#101820] border border-amber-500/40 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Session Replaced</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{sessionReplacedMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Reconnect Session
            </button>
          </div>
        </div>
      )}

      {/* Top-Left Compact Player Profile & Active Objective Strip */}
      {!hudCollapsed && (
        <div className="fixed top-4 left-4 flex flex-col gap-2 max-w-[305px] pointer-events-auto">
          <div className="bg-[#0b1014]/88 border border-white/12 rounded-xl px-3.5 py-2.5 flex items-center gap-3">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-display font-bold text-white shrink-0">
                {profile.displayName[0]}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-white truncate">
                  {profile.displayName}
                </span>
                <span className="text-[11px] font-mono-nums text-slate-400 shrink-0">
                  {isAdmin ? <span className="text-amber-400 font-semibold mr-1.5">ADMIN</span> : null}
                  Lv.{profile.level}
                </span>
              </div>

              {profile.instagramId && (
                <div className="text-[11px] text-sky-300/90 truncate">
                  @{profile.instagramId}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => togglePanel('wallet')}
                  className="inline-flex items-center gap-1 font-mono-nums font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  {profile.greenCoins.toLocaleString()} GC
                </button>
                <div className="flex items-center gap-1.5 w-24">
                  <Heart className="w-3 h-3 text-rose-400 shrink-0" />
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${health}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activeWorkShift && (
            <div className="bg-[#0b1014]/88 border border-emerald-500/35 rounded-xl px-3.5 py-2 flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => togglePanel('works')}
                className="text-left min-w-0 flex-1 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 font-medium">
                  <span>Active Work Shift</span>
                  <span className="font-mono-nums">+{activeWorkShift.payout} GC</span>
                </div>
                <div className="text-xs font-semibold text-white truncate mt-0.5">
                  {activeWorkShift.title}
                </div>
                <div className="text-[11px] text-slate-300 truncate font-mono-nums">
                  {activeWorkShift.targetName} · {workDist}m away
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkShift(null)}
                aria-label="Cancel work shift"
                className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {waypointTarget && !activeWorkShift && (
            <div className="bg-[#0b1014]/88 border border-sky-500/35 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] text-sky-300 font-medium truncate">
                    Walk to {waypointTarget.label}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-nums">
                    {wpDist}m away · Follow beacon
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaypointTarget(null)}
                aria-label="Clear waypoint"
                className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeMission && !activeWorkShift && !waypointTarget && (
            <button
              type="button"
              onClick={() => togglePanel('missions')}
              className="bg-[#0b1014]/84 hover:bg-[#101820] border border-amber-500/25 rounded-xl px-3.5 py-2 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-amber-400 font-medium">
                <span>Active Mission</span>
                <span className="font-mono-nums">+{activeMission.rewardCoins} GC</span>
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">
                {activeMission.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {activeMission.objectiveText}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Top-Right Live Radar Minimap */}
      {!hudCollapsed && (
        <div className="fixed top-4 right-4 pointer-events-auto">
          <Minimap />
        </div>
      )}

      {/* Top-Center Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[340px] max-w-[90vw] pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-[#0b1014]/94 border border-white/15 rounded-lg px-4 py-2.5 text-center"
            >
              <div
                className={`text-xs font-semibold ${
                  t.tone === 'emerald'
                    ? 'text-emerald-400'
                    : t.tone === 'amber'
                      ? 'text-amber-300'
                      : t.tone === 'rose'
                        ? 'text-rose-400'
                        : 'text-sky-300'
                }`}
              >
                {t.title}
              </div>
              {t.detail && <div className="text-[11px] text-slate-300 mt-0.5">{t.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Proximity Interaction Prompt (Clickable + Keyboard [E]) */}
      {nearbyPrompt && !activeVehicle && !activePanel && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onInteract}
            className="flex items-center gap-3 px-4 py-2.5 bg-[#0b1014]/92 hover:bg-[#132029] border border-emerald-500/45 rounded-xl transition-colors cursor-pointer"
          >
            <span className="w-7 h-7 rounded-md bg-emerald-600 text-white font-mono-nums text-xs font-bold flex items-center justify-center shrink-0">
              E
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold text-white whitespace-nowrap">
                {nearbyPrompt.label}
              </div>
              {nearbyPrompt.sublabel && (
                <div className="text-[11px] text-slate-300 whitespace-nowrap">
                  {nearbyPrompt.sublabel}
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Vehicle Speedometer (Only When Driving / Flying) */}
      {activeVehicle && (
        <div className="fixed bottom-24 right-5 bg-[#0b1014]/90 border border-white/15 rounded-xl px-4 py-3 min-w-[170px] pointer-events-auto">
          <div className="text-[11px] text-slate-400 truncate">{activeVehicle.name}</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-3xl font-extrabold font-mono-nums text-white">
              {localSpeedKmh}
            </span>
            <span className="text-xs text-emerald-400 font-medium">KM/H</span>
          </div>
          {activeVehicle.canFly && (
            <div className="text-[11px] font-mono-nums text-sky-300 mt-0.5">
              ALT {localAltitude}m · SPACE Up / SHIFT Down
            </div>
          )}
          <button
            type="button"
            onClick={onInteract}
            className="mt-2 w-full py-1.5 bg-white/8 hover:bg-white/14 text-xs font-medium text-slate-200 rounded-md cursor-pointer"
          >
            Press E to Exit Vehicle
          </button>
        </div>
      )}

      {/* Optional Mobile Touch Controls */}
      {showMobileControls && !activePanel && (
        <>
          <div className="fixed bottom-24 left-5 grid grid-cols-3 gap-1.5 w-36 pointer-events-auto">
            <div />
            <button
              type="button"
              onPointerDown={() => setMobileMove(0, 1)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              W
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => setMobileMove(-1, 0)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              A
            </button>
            <button
              type="button"
              onPointerDown={() => setMobileMove(0, -1)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              S
            </button>
            <button
              type="button"
              onPointerDown={() => setMobileMove(1, 0)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              D
            </button>
          </div>
          <div className="fixed bottom-24 right-5 flex flex-col gap-2 pointer-events-auto">
            <button
              type="button"
              onPointerDown={() => {
                mobileInputRef.current.jump = true;
              }}
              onPointerUp={() => {
                mobileInputRef.current.jump = false;
              }}
              onPointerLeave={() => {
                mobileInputRef.current.jump = false;
              }}
              className="px-4 py-3 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              JUMP
            </button>
            <button
              type="button"
              onClick={onInteract}
              className="px-4 py-3 bg-emerald-600 text-white rounded-lg text-xs font-bold"
            >
              INTERACT
            </button>
          </div>
        </>
      )}

      {/* Emote Quick Picker Popover */}
      {showEmotes && !hudCollapsed && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0b1014]/94 border border-white/15 rounded-xl p-2 flex items-center gap-1.5 pointer-events-auto">
          {EMOTES.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() => {
                triggerEmote(em.id);
                setShowEmotes(false);
                playSfx('click');
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {em.label}
            </button>
          ))}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Center Occlusion) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[96vw] pointer-events-auto">
        <button
          type="button"
          onClick={toggleHudCollapsed}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0b1014]/85 hover:bg-[#121c24] border border-white/12 rounded-md text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show HUD (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide HUD (H)
            </>
          )}
        </button>

        {!hudCollapsed && (
          <nav
            aria-label="Game Actions"
            className="bg-[#0b1014]/90 border border-white/12 rounded-xl px-2 py-1.5 flex items-center gap-1 overflow-x-auto max-w-[95vw]"
          >
            <DockButton
              icon={<MessageSquare className="w-4 h-4" />}
              label="Chat"
              active={activePanel === 'chat'}
              onClick={() => togglePanel('chat')}
            />
            <DockButton
              icon={<Briefcase className="w-4 h-4" />}
              label="Works"
              active={activePanel === 'works'}
              onClick={() => togglePanel('works')}
            />
            <DockButton
              icon={<Compass className="w-4 h-4" />}
              label="Missions"
              active={activePanel === 'missions'}
              onClick={() => togglePanel('missions')}
            />
            <DockButton
              icon={<Home className="w-4 h-4" />}
              label="Homes"
              active={activePanel === 'properties'}
              onClick={() => togglePanel('properties')}
            />
            <DockButton
              icon={<Building2 className="w-4 h-4" />}
              label="Businesses"
              active={activePanel === 'businesses'}
              onClick={() => togglePanel('businesses')}
            />
            <DockButton
              icon={<Car className="w-4 h-4" />}
              label="Vehicles"
              active={activePanel === 'vehicles'}
              onClick={() => togglePanel('vehicles')}
            />
            <DockButton
              icon={<Package className="w-4 h-4" />}
              label="Shop"
              active={activePanel === 'inventory'}
              onClick={() => togglePanel('inventory')}
            />
            <DockButton
              icon={<Users className="w-4 h-4" />}
              label={friendRequests.length > 0 ? `Friends (${friendRequests.length})` : 'Friends'}
              active={activePanel === 'friends'}
              onClick={() => togglePanel('friends')}
            />
            <DockButton
              icon={<Smile className="w-4 h-4" />}
              label="Emotes"
              active={showEmotes}
              onClick={() => {
                playSfx('click');
                setShowEmotes((v) => !v);
              }}
            />
            {isAdmin && (
              <DockButton
                icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
                label="Admin"
                active={activePanel === 'admin'}
                onClick={() => togglePanel('admin')}
              />
            )}
            <DockButton
              icon={<Menu className="w-4 h-4" />}
              label="Menu"
              active={activePanel === 'pause'}
              onClick={() => togglePanel('pause')}
            />
          </nav>
        )}
      </div>

      {/* Modal & Drawer Game Panels */}
      <GamePanels />
    </div>
  );
}

function DockButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
        active
          ? 'bg-emerald-600 text-white'
          : 'text-slate-300 hover:text-white hover:bg-white/8'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

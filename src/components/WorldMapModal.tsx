import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Bus,
  ExternalLink,
  Heart,
  Home,
  MapPin,
  Navigation,
  Plus,
  Store,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import type { CustomLocationPin, LocationCategory } from '../shared/types.ts';
import {
  ACTIVE_BUILDINGS,
  DISTRICTS,
  SHOWCASE_ADS,
} from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';
import { syncPlayerProgressToFirestore } from '../lib/firebase.ts';
import { playSfx } from '../game/audio.ts';

interface SelectedMarker {
  id: string;
  title: string;
  subtitle: string;
  x: number;
  z: number;
  kind: 'building' | 'home' | 'shop' | 'vehicle' | 'custom' | 'mingle';
  buildingId?: string;
  customShopId?: string;
  customLocationId?: string;
}

const WORLD_SPAN = 840; // -420 to +420

const CATEGORY_COLORS: Record<LocationCategory, string> = {
  favorite: '#f59e0b',
  home: '#10b981',
  hangout: '#38bdf8',
  tea: '#f43f5e',
  event: '#a855f7',
};

export function WorldMapModal() {
  const showWorldMapModal = useGameStore((s) => s.showWorldMapModal);
  const setShowWorldMapModal = useGameStore((s) => s.setShowWorldMapModal);
  const profile = useGameStore((s) => s.profile);
  const patchProfile = useGameStore((s) => s.patchProfile);
  const localPos = useGameStore((s) => s.localPos);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const vehicles = useGameStore((s) => s.vehicles);
  const customHomes = useGameStore((s) => s.customHomes);
  const customShops = useGameStore((s) => s.customShops);
  const mingleEvent = useGameStore((s) => s.mingleEvent);
  const setWaypointTarget = useGameStore((s) => s.setWaypointTarget);
  const requestTeleport = useGameStore((s) => s.requestTeleport);
  const openBuildingPanel = useGameStore((s) => s.openBuildingPanel);
  const openPlayerShopPanel = useGameStore((s) => s.openPlayerShopPanel);
  const pushToast = useGameStore((s) => s.pushToast);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1.25);
  const [pan, setPan] = useState({ x: 0, z: 0 });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanZ: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, startPanX: 0, startPanZ: 0 });

  const [addMode, setAddMode] = useState(false);
  const [draftPinCoords, setDraftPinCoords] = useState<{ x: number; z: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState<LocationCategory>('favorite');
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(null);

  const [showBuildings, setShowBuildings] = useState(true);
  const [showHomes, setShowHomes] = useState(true);
  const [showShops, setShowShops] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showCustomPins, setShowCustomPins] = useState(true);
  const [adIndex, setAdIndex] = useState(0);

  useEffect(() => {
    if (!showWorldMapModal) return;
    const id = window.setInterval(() => {
      setAdIndex((i) => (i + 1) % SHOWCASE_ADS.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [showWorldMapModal]);

  // Center on player when opened
  useEffect(() => {
    if (showWorldMapModal) {
      setPan({ x: localPos.x, z: localPos.z });
      setZoom(1.35);
      setAddMode(false);
      setDraftPinCoords(null);
      setSelectedMarker(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWorldMapModal]);

  const canvasSize = 640;

  const worldToScreen = (wx: number, wz: number, width: number, height: number): [number, number] => {
    const pxPerMeter = (Math.min(width, height) / WORLD_SPAN) * zoom;
    return [
      width / 2 + (wx - pan.x) * pxPerMeter,
      height / 2 + (wz - pan.z) * pxPerMeter,
    ];
  };

  const screenToWorld = (sx: number, sy: number, width: number, height: number): { x: number; z: number } => {
    const pxPerMeter = (Math.min(width, height) / WORLD_SPAN) * zoom;
    return {
      x: Math.max(-380, Math.min(380, pan.x + (sx - width / 2) / pxPerMeter)),
      z: Math.max(-380, Math.min(380, pan.z + (sy - height / 2) / pxPerMeter)),
    };
  };

  useEffect(() => {
    if (!showWorldMapModal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pxPerMeter = (Math.min(w, h) / WORLD_SPAN) * zoom;
    const toScreen = (wx: number, wz: number): [number, number] => [
      w / 2 + (wx - pan.x) * pxPerMeter,
      h / 2 + (wz - pan.z) * pxPerMeter,
    ];

    ctx.clearRect(0, 0, w, h);

    // Base valley grass
    ctx.fillStyle = '#13271c';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines every 100m
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let g = -400; g <= 400; g += 100) {
      const [gx0, gy0] = toScreen(g, -420);
      const [gx1, gy1] = toScreen(g, 420);
      ctx.beginPath();
      ctx.moveTo(gx0, gy0);
      ctx.lineTo(gx1, gy1);
      ctx.stroke();

      const [hx0, hy0] = toScreen(-420, g);
      const [hx1, hy1] = toScreen(420, g);
      ctx.beginPath();
      ctx.moveTo(hx0, hy0);
      ctx.lineTo(hx1, hy1);
      ctx.stroke();
    }

    // Emerald Lake (-115, 115)
    const [lx, lz] = toScreen(-115, 115);
    ctx.fillStyle = '#1d5d84';
    ctx.beginPath();
    ctx.ellipse(lx, lz, 72 * pxPerMeter, 58 * pxPerMeter, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Main 700m Grand Highways
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(4, 12 * pxPerMeter);
    const [n0x, n0y] = toScreen(0, -350);
    const [n1x, n1y] = toScreen(0, 350);
    ctx.beginPath();
    ctx.moveTo(n0x, n0y);
    ctx.lineTo(n1x, n1y);
    ctx.stroke();

    const [e0x, e0y] = toScreen(-350, 0);
    const [e1x, e1y] = toScreen(350, 0);
    ctx.beginPath();
    ctx.moveTo(e0x, e0y);
    ctx.lineTo(e1x, e1y);
    ctx.stroke();

    // Dashed road centerlines
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(n0x, n0y);
    ctx.lineTo(n1x, n1y);
    ctx.moveTo(e0x, e0y);
    ctx.lineTo(e1x, e1y);
    ctx.stroke();
    ctx.restore();

    // Sunset Valley Avenue (-215, -165..45)
    const [sv0x, sv0y] = toScreen(-215, -165);
    const [sv1x, sv1y] = toScreen(-215, 45);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(3, 8 * pxPerMeter);
    ctx.beginPath();
    ctx.moveTo(sv0x, sv0y);
    ctx.lineTo(sv1x, sv1y);
    ctx.stroke();

    // Central Plaza Ring
    const [cx, cy] = toScreen(0, 0);
    ctx.fillStyle = 'rgba(214, 198, 175, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * pxPerMeter, 0, Math.PI * 2);
    ctx.fill();

    // District Names
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [dx, dy] = toScreen(d.x, d.z);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.fillText(d.name.toUpperCase(), dx, dy);
    }

    // Active Enterable Buildings (12 major hubs)
    if (showBuildings) {
      for (const b of ACTIVE_BUILDINGS) {
        const [bx, by] = toScreen(b.doorPosition.x, b.doorPosition.z);
        ctx.fillStyle = b.accent;
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b1014';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (zoom >= 1.05) {
          ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(b.name.replace('Green Valley ', ''), bx, by - 9);
        }
      }
    }

    // Custom Homes
    if (showHomes) {
      for (const ch of Object.values(customHomes)) {
        const [hx, hy] = toScreen(ch.x, ch.z);
        ctx.fillStyle = ch.createdByAdmin ? '#f59e0b' : '#34d399';
        ctx.fillRect(hx - 4.5, hy - 4.5, 9, 9);
        ctx.strokeStyle = '#0b1014';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx - 4.5, hy - 4.5, 9, 9);
        if (zoom >= 1.35) {
          ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#a7f3d0';
          ctx.fillText(ch.name, hx, hy - 8);
        }
      }
    }

    // Player Custom Shops (Tea Stalls, Juice Bars, Bakeries)
    if (showShops) {
      for (const sh of Object.values(customShops)) {
        const [sx, sy] = toScreen(sh.x, sh.z);
        ctx.fillStyle = sh.awningColor || '#e11d48';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 6);
        ctx.lineTo(sx + 6, sy + 5);
        ctx.lineTo(sx - 6, sy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (zoom >= 1.15) {
          ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#fecdd3';
          ctx.fillText(sh.name, sx, sy - 9);
        }
      }
    }

    // Vehicles (KSRTC Buses highlighted in red & yellow)
    if (showVehicles) {
      for (const v of Object.values(vehicles)) {
        const [vx, vy] = toScreen(v.x, v.z);
        if (v.kind === 'ksrtc_bus') {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(vx - 6, vy - 3.5, 12, 7);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(vx - 6, vy - 1, 12, 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(vx - 6, vy - 3.5, 12, 7);
          if (zoom >= 1.0) {
            ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#fde047';
            ctx.fillText('KSRTC', vx, vy - 7);
          }
        } else {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(vx - 3, vy - 3, 6, 6);
        }
      }
    }

    // Mingle Meetup Location Heart Ring
    const [mx, my] = toScreen(mingleEvent.locationPos.x, mingleEvent.locationPos.z);
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, Math.PI * 2);
    ctx.stroke();

    // User Custom Location Pins
    if (showCustomPins && profile?.customLocations) {
      for (const pin of profile.customLocations) {
        const [px, py] = toScreen(pin.x, pin.z);
        ctx.fillStyle = CATEGORY_COLORS[pin.category] || '#f59e0b';
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#fef3c7';
        ctx.fillText(pin.name, px, py - 10);
      }
    }

    // Draft pin preview when placing a new custom location
    if (draftPinCoords) {
      const [dx, dy] = toScreen(draftPinCoords.x, draftPinCoords.z);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(dx, dy, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Remote Online Players
    for (const rp of Object.values(remotePlayers)) {
      const [rx, ry] = toScreen(rp.x, rp.z);
      ctx.fillStyle = rp.isAdmin ? '#f59e0b' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#bae6fd';
      ctx.fillText(rp.displayName, rx, ry - 8);
    }

    // Local Player Arrow
    const [plx, ply] = toScreen(localPos.x, localPos.z);
    ctx.save();
    ctx.translate(plx, ply);
    ctx.rotate(-localPos.rotY + Math.PI);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }, [
    showWorldMapModal,
    zoom,
    pan,
    localPos,
    remotePlayers,
    vehicles,
    customHomes,
    customShops,
    mingleEvent,
    profile?.customLocations,
    draftPinCoords,
    showBuildings,
    showHomes,
    showShops,
    showVehicles,
    showCustomPins,
  ]);

  if (!showWorldMapModal || !profile) return null;

  const currentAd = SHOWCASE_ADS[adIndex % SHOWCASE_ADS.length];

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanZ: pan.z,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const pxPerMeter = (canvasSize / WORLD_SPAN) * zoom;
    const nextX = Math.max(-380, Math.min(380, dragRef.current.startPanX - (dx * scaleX) / pxPerMeter));
    const nextZ = Math.max(-380, Math.min(380, dragRef.current.startPanZ - (dy * scaleX) / pxPerMeter));
    setPan({ x: nextX, z: nextZ });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (wasDrag) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const sy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const worldPt = screenToWorld(sx, sy, canvas.width, canvas.height);

    if (addMode) {
      setDraftPinCoords({ x: Math.round(worldPt.x), z: Math.round(worldPt.z) });
      setSelectedMarker(null);
      playSfx('click');
      return;
    }

    // Hit-test interactive markers (within 18px)
    const candidates: SelectedMarker[] = [];
    if (showCustomPins) {
      for (const p of profile.customLocations || []) {
        candidates.push({
          id: p.id,
          title: p.name,
          subtitle: `My Saved Pin (${p.category})`,
          x: p.x,
          z: p.z,
          kind: 'custom',
          customLocationId: p.id,
        });
      }
    }
    if (showBuildings) {
      for (const b of ACTIVE_BUILDINGS) {
        candidates.push({
          id: b.id,
          title: b.name,
          subtitle: b.subtitle,
          x: b.doorPosition.x,
          z: b.doorPosition.z,
          kind: 'building',
          buildingId: b.id,
        });
      }
    }
    if (showShops) {
      for (const s of Object.values(customShops)) {
        candidates.push({
          id: s.shopId,
          title: s.name,
          subtitle: `Player Shop by ${s.ownerName}${s.ownerInstagram ? ` (@${s.ownerInstagram})` : ''}`,
          x: s.x,
          z: s.z,
          kind: 'shop',
          customShopId: s.shopId,
        });
      }
    }
    if (showHomes) {
      for (const h of Object.values(customHomes)) {
        candidates.push({
          id: h.homeId,
          title: h.name,
          subtitle: `Home of ${h.ownerName}${h.ownerInstagram ? ` (@${h.ownerInstagram})` : ''}`,
          x: h.x,
          z: h.z + 9,
          kind: 'home',
        });
      }
    }
    if (showVehicles) {
      for (const v of Object.values(vehicles)) {
        candidates.push({
          id: v.id,
          title: v.name,
          subtitle: v.kind === 'ksrtc_bus' ? 'KSRTC Kerala Super Fast Bus' : `Vehicle · Rent ${v.rentPrice} GC`,
          x: v.x,
          z: v.z,
          kind: 'vehicle',
        });
      }
    }
    candidates.push({
      id: 'mingle-spot',
      title: `Single-to-Mingle: ${mingleEvent.locationName}`,
      subtitle: 'Hourly Matchmaking Meetup Point',
      x: mingleEvent.locationPos.x,
      z: mingleEvent.locationPos.z,
      kind: 'mingle',
    });

    let best: SelectedMarker | null = null;
    let bestPx = 22;
    for (const c of candidates) {
      const [cx, cy] = worldToScreen(c.x, c.z, canvas.width, canvas.height);
      const dist = Math.hypot(cx - sx, cy - sy);
      if (dist < bestPx) {
        bestPx = dist;
        best = c;
      }
    }
    setSelectedMarker(best);
    if (best) playSfx('click');
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 0.85;
    setZoom((z) => Math.max(0.55, Math.min(4.0, Number((z * factor).toFixed(2)))));
  };

  const handleSaveCustomPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftPinCoords) return;
    const name = draftName.trim().slice(0, 28);
    if (!name) return;
    const existing = profile.customLocations || [];
    if (existing.length >= 15) {
      pushToast('Pin Limit Reached', 'You can save up to 15 custom map locations.', 'amber');
      return;
    }
    const newPin: CustomLocationPin = {
      id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      category: draftCategory,
      x: draftPinCoords.x,
      z: draftPinCoords.z,
    };
    const nextLocations = [...existing, newPin];
    patchProfile({ customLocations: nextLocations });
    void syncPlayerProgressToFirestore({ ...profile, customLocations: nextLocations }).catch(() => {});
    setDraftName('');
    setDraftPinCoords(null);
    setAddMode(false);
    playSfx('coin');
    pushToast('Location Pinned!', `${newPin.name} saved to your Green Valley map.`, 'emerald');
  };

  const handleDeleteCustomPin = (pinId: string) => {
    const nextLocations = (profile.customLocations || []).filter((p) => p.id !== pinId);
    patchProfile({ customLocations: nextLocations });
    void syncPlayerProgressToFirestore({ ...profile, customLocations: nextLocations }).catch(() => {});
    if (selectedMarker?.customLocationId === pinId) {
      setSelectedMarker(null);
    }
    pushToast('Location Removed', 'Pin deleted from your map.', 'sky');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pointer-events-auto">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#0b1116] border border-white/15 rounded-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Green Valley Interactive World Map
            </h2>
            <p className="text-xs text-slate-400">
              Scroll or use +/- to zoom ({zoom.toFixed(1)}×) · Drag to pan · Click any landmark or add your own location pins
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAddMode((v) => !v);
                setDraftPinCoords(null);
                setSelectedMarker(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                addMode
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {addMode ? 'Click Map to Place Pin...' : 'Add Custom Location'}
            </button>
            <button
              type="button"
              onClick={() => setShowWorldMapModal(false)}
              aria-label="Close world map"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Map Canvas + Side Controls */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_290px] overflow-hidden">
          {/* Interactive Zoomable Map Canvas */}
          <div className="relative bg-[#0c1a13] flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onWheel={handleWheel}
              className={`w-full h-full max-h-[62vh] lg:max-h-full object-contain touch-none ${
                addMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
              }`}
            />

            {/* Floating Zoom Controls */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4.0, Number((z + 0.35).toFixed(2))))}
                aria-label="Zoom in"
                className="p-2 bg-[#0b1014]/90 hover:bg-[#132029] border border-white/15 rounded-lg text-white cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.35).toFixed(2))))}
                aria-label="Zoom out"
                className="p-2 bg-[#0b1014]/90 hover:bg-[#132029] border border-white/15 rounded-lg text-white cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPan({ x: localPos.x, z: localPos.z });
                  setZoom(1.35);
                }}
                aria-label="Center on me"
                title="Center on me"
                className="p-2 bg-[#0b1014]/90 hover:bg-[#132029] border border-white/15 rounded-lg text-emerald-400 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Toggles Overlay */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {[
                { label: 'Buildings', on: showBuildings, set: setShowBuildings },
                { label: 'Homes', on: showHomes, set: setShowHomes },
                { label: 'Shops', on: showShops, set: setShowShops },
                { label: 'KSRTC & Cars', on: showVehicles, set: setShowVehicles },
                { label: 'My Pins', on: showCustomPins, set: setShowCustomPins },
              ].map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => f.set((v) => !v)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                    f.on
                      ? 'bg-[#0b1014]/90 border-emerald-500/45 text-emerald-300'
                      : 'bg-[#0b1014]/70 border-white/10 text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Sidebar: Add Pin Form / Selected Marker / Saved Pins & Quick Travel */}
          <div className="border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0e161d] p-4 overflow-y-auto space-y-4">
            {draftPinCoords && (
              <form
                onSubmit={handleSaveCustomPin}
                className="p-3.5 bg-[#132029] border border-emerald-500/40 rounded-xl space-y-3"
              >
                <div className="text-xs font-bold text-emerald-300">
                  Save New Custom Location ({draftPinCoords.x}, {draftPinCoords.z})
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={28}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Location name (e.g. Tea Spot)"
                  className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-xs text-white outline-none"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {(['favorite', 'hangout', 'tea', 'home', 'event'] as LocationCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDraftCategory(cat)}
                      className={`py-1.5 text-[11px] capitalize rounded-md border cursor-pointer ${
                        draftCategory === cat
                          ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200'
                          : 'bg-[#0a1015] border-white/10 text-slate-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Save Location Pin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPinCoords(null);
                      setAddMode(false);
                    }}
                    className="px-3 py-2 bg-white/8 hover:bg-white/14 text-slate-300 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {selectedMarker && (
              <div className="p-3.5 bg-[#131d25] border border-sky-500/40 rounded-xl space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{selectedMarker.title}</div>
                    <div className="text-[11px] text-slate-300">{selectedMarker.subtitle}</div>
                    <div className="text-[10px] text-slate-400 font-mono-nums mt-0.5">
                      Coords: ({Math.round(selectedMarker.x)}, {Math.round(selectedMarker.z)})
                    </div>
                  </div>
                  {selectedMarker.customLocationId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomPin(selectedMarker.customLocationId!)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 cursor-pointer"
                      aria-label="Delete location pin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWaypointTarget({
                        x: selectedMarker.x,
                        z: selectedMarker.z,
                        label: selectedMarker.title,
                      });
                      setShowWorldMapModal(false);
                      pushToast('Waypoint Set', `Follow beacon to ${selectedMarker.title}`, 'sky');
                    }}
                    className="inline-flex items-center justify-center gap-1 py-2 bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Waypoint
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      requestTeleport({ x: selectedMarker.x, y: 0, z: selectedMarker.z });
                      setShowWorldMapModal(false);
                      pushToast('Fast Travel', `Arrived at ${selectedMarker.title}`, 'emerald');
                    }}
                    className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Fast Travel
                  </button>
                </div>
                {selectedMarker.buildingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowWorldMapModal(false);
                      openBuildingPanel(selectedMarker.buildingId!);
                    }}
                    className="w-full py-1.5 bg-white/8 hover:bg-white/15 text-xs font-medium text-white rounded-lg cursor-pointer"
                  >
                    Open Building Services
                  </button>
                )}
                {selectedMarker.customShopId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowWorldMapModal(false);
                      openPlayerShopPanel(selectedMarker.customShopId!);
                    }}
                    className="w-full py-1.5 bg-white/8 hover:bg-white/15 text-xs font-medium text-white rounded-lg cursor-pointer"
                  >
                    Visit Shop Menu
                  </button>
                )}
              </div>
            )}

            {/* Quick Jump Landmarks */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active Buildings & Hubs
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {ACTIVE_BUILDINGS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setPan({ x: b.doorPosition.x, z: b.doorPosition.z });
                      setZoom(2.1);
                      setSelectedMarker({
                        id: b.id,
                        title: b.name,
                        subtitle: b.subtitle,
                        x: b.doorPosition.x,
                        z: b.doorPosition.z,
                        kind: 'building',
                        buildingId: b.id,
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#131d25] hover:bg-[#1a2833] border border-white/8 rounded-lg flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span className="text-xs font-medium text-slate-200 truncate flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: b.accent }}
                      />
                      {b.name.replace('Green Valley ', '')}
                    </span>
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Custom Locations */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                My Custom Pins ({(profile.customLocations || []).length}/15)
              </div>
              {(profile.customLocations || []).length === 0 ? (
                <p className="text-xs text-slate-500">
                  Click &ldquo;Add Custom Location&rdquo; above and tap anywhere on the map to bookmark your favorite spots.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(profile.customLocations || []).map((pin) => (
                    <div
                      key={pin.id}
                      className="px-2.5 py-2 bg-[#131d25] border border-white/8 rounded-lg flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPan({ x: pin.x, z: pin.z });
                          setZoom(2.2);
                          setSelectedMarker({
                            id: pin.id,
                            title: pin.name,
                            subtitle: `My Saved Pin (${pin.category})`,
                            x: pin.x,
                            z: pin.z,
                            kind: 'custom',
                            customLocationId: pin.id,
                          });
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-white truncate">{pin.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {pin.category} · ({pin.x}, {pin.z})
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomPin(pin.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        aria-label={`Delete ${pin.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Bus className="w-3 h-3 text-red-400" /> KSRTC Bus
              </div>
              <div className="flex items-center gap-1.5">
                <Store className="w-3 h-3 text-rose-400" /> Tea Stall / Shop
              </div>
              <div className="flex items-center gap-1.5">
                <Home className="w-3 h-3 text-emerald-400" /> Player Homes
              </div>
              <div className="flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-rose-400" /> Mingle Meetup
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Typixel Showcase Ad Bar */}
        <a
          href={currentAd.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 bg-[#090e13] border-t border-white/10 flex items-center justify-between gap-3 hover:bg-[#101922] transition-colors shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentAd.imageUrl}
              alt={currentAd.title}
              className="w-14 h-9 rounded object-cover border border-white/15 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {currentAd.title} <span className="text-[10px] font-normal text-amber-300 ml-1">SPONSORED</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{currentAd.subtitle}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0">
            @typixelofficial <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </a>
      </div>
    </div>
  );
}

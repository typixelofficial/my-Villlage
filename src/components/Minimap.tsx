import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { DISTRICTS, MISSIONS } from '../shared/worldData.ts';

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const localPos = useGameStore((s) => s.localPos);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const vehicles = useGameStore((s) => s.vehicles);
  const customHomes = useGameStore((s) => s.customHomes);
  const activeMissionId = useGameStore((s) => s.activeMissionId);
  const activeWorkShift = useGameStore((s) => s.activeWorkShift);
  const waypointTarget = useGameStore((s) => s.waypointTarget);
  const currentDistrictName = useGameStore((s) => s.currentDistrictName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 148;
    const half = size / 2;
    const scale = 0.22; // Wider radar zoom for 840m x 840m Green Valley

    ctx.clearRect(0, 0, size, size);

    // Base valley terrain backdrop
    ctx.fillStyle = '#14261c';
    ctx.fillRect(0, 0, size, size);

    const toMap = (wx: number, wz: number): [number, number] => [
      half + (wx - localPos.x) * scale,
      half + (wz - localPos.z) * scale,
    ];

    // Expanded Lake in South-West (-115, 115)
    const [lx, lz] = toMap(-115, 115);
    ctx.fillStyle = '#1e5f85';
    ctx.beginPath();
    ctx.ellipse(lx, lz, 72 * scale, 58 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Long 700m Grand Highways
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.38)';
    ctx.lineWidth = 3;
    const [r0x, r0y] = toMap(0, -350);
    const [r1x, r1y] = toMap(0, 350);
    ctx.beginPath();
    ctx.moveTo(r0x, r0y);
    ctx.lineTo(r1x, r1y);
    ctx.stroke();

    const [h0x, h0y] = toMap(-350, 0);
    const [h1x, h1y] = toMap(350, 0);
    ctx.beginPath();
    ctx.moveTo(h0x, h0y);
    ctx.lineTo(h1x, h1y);
    ctx.stroke();

    // Central Plaza Ring
    const [cx, cy] = toMap(0, 0);
    ctx.fillStyle = 'rgba(214, 198, 175, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    // District Subtle Landmarks
    ctx.font = '600 8px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [dx, dy] = toMap(d.x, d.z);
      if (dx < -24 || dx > size + 24 || dy < -24 || dy > size + 24) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.fillText(d.name.split(' ')[0], dx, dy);
    }

    // Custom 3D Homes (Emerald / Gold House Diamonds)
    for (const ch of Object.values(customHomes)) {
      const [hx, hy] = toMap(ch.x, ch.z);
      if (hx < 2 || hx > size - 2 || hy < 2 || hy > size - 2) continue;
      ctx.fillStyle = ch.createdByAdmin ? '#f59e0b' : '#34d399';
      ctx.fillRect(hx - 2.5, hy - 2.5, 5, 5);
    }

    // Vehicles (subtle amber squares)
    ctx.fillStyle = '#fbbf24';
    for (const v of Object.values(vehicles)) {
      const [vx, vy] = toMap(v.x, v.z);
      if (vx < 2 || vx > size - 2 || vy < 2 || vy > size - 2) continue;
      ctx.fillRect(vx - 1.8, vy - 1.8, 3.6, 3.6);
    }

    // Active Objective Marker (Work Shift > Walk-To Waypoint > Mission)
    const activeMission = activeMissionId
      ? MISSIONS.find((m) => m.id === activeMissionId)
      : null;
    const objectivePos = activeWorkShift
      ? activeWorkShift.target
      : waypointTarget
        ? { x: waypointTarget.x, z: waypointTarget.z }
        : activeMission
          ? activeMission.target
          : null;

    if (objectivePos) {
      const [mx, my] = toMap(objectivePos.x, objectivePos.z);
      const clampedX = Math.max(8, Math.min(size - 8, mx));
      const clampedY = Math.max(8, Math.min(size - 8, my));
      ctx.strokeStyle = activeWorkShift ? '#34d399' : waypointTarget ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Remote Online Players (Crisp Cyan Dots)
    for (const rp of Object.values(remotePlayers)) {
      const [rx, ry] = toMap(rp.x, rp.z);
      const clampedX = Math.max(5, Math.min(size - 5, rx));
      const clampedY = Math.max(5, Math.min(size - 5, ry));
      ctx.fillStyle = rp.isAdmin ? '#f59e0b' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b1014';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Local Player Center Directional Arrow
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-localPos.rotY + Math.PI);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }, [localPos, remotePlayers, vehicles, customHomes, activeMissionId, activeWorkShift, waypointTarget]);

  const onlineCount = Object.keys(remotePlayers).length + 1;

  return (
    <div className="bg-[#0b1014]/88 border border-white/12 rounded-xl p-2.5 w-[168px] select-none">
      <div className="relative w-[148px] h-[148px] rounded-lg overflow-hidden border border-white/10">
        <canvas ref={canvasRef} width={148} height={148} className="block w-full h-full" />
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono-nums font-bold text-slate-300/80">
          N
        </span>
      </div>
      <div className="mt-2 space-y-0.5">
        <div className="text-[11px] font-semibold text-white truncate">
          {currentDistrictName}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-nums">
          <span>
            {Math.round(localPos.x)}, {Math.round(localPos.z)}
          </span>
          <span className="text-emerald-400">{onlineCount} Online</span>
        </div>
      </div>
    </div>
  );
}

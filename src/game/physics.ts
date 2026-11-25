import RAPIER from '@dimforge/rapier3d-compat';
import { WORLD_HALF_SIZE, groundHeightAt } from '../shared/worldData.ts';

export interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export class WorldPhysics {
  private rapierWorld: RAPIER.World | null = null;
  private rapierReady = false;
  public colliders: BoxCollider[] = [];

  async init(): Promise<void> {
    try {
      await RAPIER.init();
      this.rapierWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      this.rapierReady = true;

      // Register any colliders already added before WASM finished initializing
      for (const box of this.colliders) {
        this.attachRapierBox(box);
      }
    } catch (err) {
      console.warn('Rapier WASM init fallback to analytical solver:', err);
      this.rapierReady = false;
    }
  }

  private attachRapierBox(box: BoxCollider): void {
    if (!this.rapierWorld || !this.rapierReady) return;
    const hx = (box.maxX - box.minX) * 0.5;
    const hy = (box.maxY - box.minY) * 0.5;
    const hz = (box.maxZ - box.minZ) * 0.5;
    const cx = (box.minX + box.maxX) * 0.5;
    const cy = (box.minY + box.maxY) * 0.5;
    const cz = (box.minZ + box.maxZ) * 0.5;
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz);
    this.rapierWorld.createCollider(desc);
  }

  addStaticBox(
    id: string,
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
  ): void {
    this.removeStaticBox(id);
    const box: BoxCollider = {
      id,
      minX: cx - sx * 0.5,
      maxX: cx + sx * 0.5,
      minY: cy - sy * 0.5,
      maxY: cy + sy * 0.5,
      minZ: cz - sz * 0.5,
      maxZ: cz + sz * 0.5,
    };
    this.colliders.push(box);
    this.attachRapierBox(box);
  }

  removeStaticBox(id: string): void {
    const idx = this.colliders.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.colliders.splice(idx, 1);
    }
  }

  step(): void {
    if (this.rapierWorld && this.rapierReady) {
      this.rapierWorld.step();
    }
  }

  /**
   * Resolves horizontal circle-vs-AABB collisions and world perimeter bounds,
   * returning collision-corrected (x, z) plus whether a wall hit occurred.
   */
  resolveHorizontal(
    x: number,
    y: number,
    z: number,
    radius: number,
    actorHeight: number,
  ): { x: number; z: number; collided: boolean } {
    let rx = Math.max(-WORLD_HALF_SIZE + 4, Math.min(WORLD_HALF_SIZE - 4, x));
    let rz = Math.max(-WORLD_HALF_SIZE + 4, Math.min(WORLD_HALF_SIZE - 4, z));
    let collided = rx !== x || rz !== z;

    for (let i = 0; i < this.colliders.length; i++) {
      const b = this.colliders[i];
      // Vertical overlap check (allows flying taxis to soar over buildings!)
      if (y >= b.maxY - 0.1 || y + actorHeight <= b.minY + 0.1) continue;

      const closestX = Math.max(b.minX, Math.min(rx, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(rz, b.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        collided = true;
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Center inside box: push out along shallowest axis
          const penLeft = Math.abs(rx - b.minX);
          const penRight = Math.abs(b.maxX - rx);
          const penTop = Math.abs(rz - b.minZ);
          const penBottom = Math.abs(b.maxZ - rz);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) rx = b.minX - radius;
          else if (minPen === penRight) rx = b.maxX + radius;
          else if (minPen === penTop) rz = b.minZ - radius;
          else rz = b.maxZ + radius;
        }
      }
    }

    return { x: rx, z: rz, collided };
  }

  /**
   * Computes ground height supporting walking across piers/bridges above shallow lake water.
   */
  getGroundHeight(x: number, z: number): number {
    // Wooden pier over the Golden Sands Beach lake
    if (x >= -74 && x <= -42 && z >= 79 && z <= 86) {
      return 0.45;
    }
    // Stone bridge crossing the West River along Grand West Boulevard (x = -152)
    if (x >= -170 && x <= -134 && z >= -7.5 && z <= 7.5) {
      return 0.25;
    }
    const terrainY = groundHeightAt(x, z);
    // Prevent sinking underwater; wade at shallow shoreline depth
    return Math.max(-0.22, terrainY);
  }

  /**
   * Pulls third-person camera forward if a building lies between target and desired camera pos.
   */
  clampCameraPosition(
    tx: number,
    ty: number,
    tz: number,
    cx: number,
    cy: number,
    cz: number,
  ): { x: number; y: number; z: number } {
    const steps = 8;
    let bestT = 1.0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const px = tx + (cx - tx) * t;
      const py = ty + (cy - ty) * t;
      const pz = tz + (cz - tz) * t;
      for (let i = 0; i < this.colliders.length; i++) {
        const b = this.colliders[i];
        if (
          px >= b.minX - 0.3 &&
          px <= b.maxX + 0.3 &&
          py >= b.minY &&
          py <= b.maxY + 0.3 &&
          pz >= b.minZ - 0.3 &&
          pz <= b.maxZ + 0.3
        ) {
          bestT = Math.max(0.22, (s - 1) / steps);
          break;
        }
      }
      if (bestT < 1.0) break;
    }

    const fx = tx + (cx - tx) * bestT;
    const fz = tz + (cz - tz) * bestT;
    const minGroundY = this.getGroundHeight(fx, fz) + 0.65;
    const fy = Math.max(minGroundY, ty + (cy - ty) * bestT);
    return { x: fx, y: fy, z: fz };
  }

  dispose(): void {
    if (this.rapierWorld) {
      this.rapierWorld.free();
      this.rapierWorld = null;
    }
    this.colliders = [];
  }
}

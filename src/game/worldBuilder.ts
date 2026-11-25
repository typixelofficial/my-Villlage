import * as THREE from 'three';
import type { CustomHomeDef } from '../shared/types.ts';
import {
  ATM_LOCATIONS,
  BUSINESSES,
  CUSTOM_HOME_PLANS,
  NPCS,
  PROPERTIES,
  groundHeightAt,
} from '../shared/worldData.ts';
import type { WorldPhysics } from './physics.ts';
import {
  createCobbleTexture,
  createGrassTexture,
  createNameplateSprite,
  createRoadTexture,
  createSignTexture,
  createWaterTexture,
} from './textures.ts';
import { buildCharacterRig, type CharacterRig } from './characterMesh.ts';

export interface WorldHandles {
  root: THREE.Group;
  waterMesh: THREE.Mesh;
  waterTexture: THREE.CanvasTexture;
  fountainJets: THREE.Mesh[];
  cloudsGroup: THREE.Group;
  rainPoints: THREE.Points;
  lampBulbMat: THREE.MeshStandardMaterial;
  windowGlowMat: THREE.MeshStandardMaterial;
  poolWaterMat: THREE.MeshStandardMaterial;
  npcRigs: { id: string; rig: CharacterRig; baseRotY: number }[];
  missionBeacon: THREE.Group;
  propertySigns: Map<string, THREE.Mesh>;
  sailboat: THREE.Group;
  campfireGlow: THREE.Mesh;
  dispose: () => void;
}

export function buildGreenValleyWorld(
  physics: WorldPhysics,
  maxAnisotropy: number,
): WorldHandles {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(res: T): T => {
    disposables.push(res);
    return res;
  };

  // Shared materials with varied PBR roughness/metalness
  const grassTex = track(createGrassTexture(maxAnisotropy));
  const roadTex = track(createRoadTexture(maxAnisotropy));
  const cobbleTex = track(createCobbleTexture(maxAnisotropy));
  const waterTexture = track(createWaterTexture(maxAnisotropy));

  const windowGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#fbbf24',
      emissiveIntensity: 0.12,
      roughness: 0.14,
      metalness: 0.35,
    }),
  );
  const lampBulbMat = track(
    new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      emissive: '#fde68a',
      emissiveIntensity: 0.25,
      roughness: 0.2,
    }),
  );
  const darkMetalMat = track(
    new THREE.MeshStandardMaterial({ color: '#27313d', roughness: 0.42, metalness: 0.72 }),
  );
  const concreteMat = track(
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.88, metalness: 0.04 }),
  );
  const warmStoneMat = track(
    new THREE.MeshStandardMaterial({ color: '#a89f91', roughness: 0.9, metalness: 0.02 }),
  );
  const timberMat = track(
    new THREE.MeshStandardMaterial({ color: '#7c5338', roughness: 0.84, metalness: 0.04 }),
  );
  const poolWaterMat = track(
    new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.86,
    }),
  );

  // =========================================================================
  // 1. SCULPTED 840m x 840m VALLEY TERRAIN + OUTER MOUNTAIN RING
  // =========================================================================
  grassTex.repeat.set(78, 78);
  const terrainGeo = track(new THREE.PlaneGeometry(980, 980, 150, 150));
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color('#6ca853');
  const cSand = new THREE.Color('#dfd0a5');
  const cHill = new THREE.Color('#4d8042');
  const cRock = new THREE.Color('#7a8288');
  const cSnow = new THREE.Color('#edf2f7');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const h = groundHeightAt(vx, vz);
    posAttr.setY(i, h);

    if (h < -0.08) {
      tmpColor.copy(cSand);
    } else if (h < 1.5) {
      const lakeDist = Math.hypot((vx + 115) / 1.25, (vz - 115) / 1.0);
      if (lakeDist < 72) {
        tmpColor.copy(cSand).lerp(cGrass, Math.min(1, Math.max(0, (lakeDist - 58) / 14)));
      } else {
        tmpColor.copy(cGrass);
      }
    } else if (h < 9) {
      tmpColor.copy(cGrass).lerp(cHill, (h - 1.5) / 7.5);
    } else if (h < 18) {
      tmpColor.copy(cHill).lerp(cRock, (h - 9) / 9);
    } else {
      tmpColor.copy(cRock).lerp(cSnow, Math.min(1, (h - 18) / 8));
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      map: grassTex,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // Glistening Lake & River Water Surface (y = -0.35)
  const waterMat = track(
    new THREE.MeshStandardMaterial({
      map: waterTexture,
      color: '#38bdf8',
      roughness: 0.14,
      metalness: 0.22,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const waterMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(310, 310)), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(-125, -0.35, 80);
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  // Distant Snow-Capped Mountain Ring (Natural Horizon Perimeter around 840m valley)
  const mountainMat = track(new THREE.MeshStandardMaterial({ color: '#6b7b84', roughness: 0.94 }));
  const snowCapMat = track(new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.8 }));
  const mtnCount = 44;
  for (let i = 0; i < mtnCount; i++) {
    const angle = (i / mtnCount) * Math.PI * 2;
    const dist = 445 + (i % 3) * 32;
    const height = 58 + ((i * 23) % 44);
    const radius = 44 + ((i * 15) % 24);
    const mGroup = new THREE.Group();
    mGroup.position.set(Math.cos(angle) * dist, -2, Math.sin(angle) * dist);
    const base = new THREE.Mesh(track(new THREE.ConeGeometry(radius, height, 7)), mountainMat);
    base.position.y = height * 0.5;
    base.rotation.y = i * 0.7;
    const cap = new THREE.Mesh(
      track(new THREE.ConeGeometry(radius * 0.34, height * 0.34, 7)),
      snowCapMat,
    );
    cap.position.y = height * 0.84;
    cap.rotation.y = i * 0.7;
    mGroup.add(base, cap);
    root.add(mGroup);
  }

  // =========================================================================
  // 2. LONG SCENIC HIGHWAY NETWORK, BRIDGES & CENTRAL FOUNTAIN PLAZA
  // =========================================================================
  const roadMat = track(
    new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.86,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );

  const addRoad = (x: number, z: number, width: number, length: number, rotY = 0) => {
    const geo = track(new THREE.PlaneGeometry(width, length));
    const mesh = new THREE.Mesh(geo, roadMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    mesh.position.set(x, 0.04, z);
    mesh.receiveShadow = true;
    root.add(mesh);
  };

  // Long 700m North-South & East-West Emerald Grand Highways + District Loops
  addRoad(0, 0, 11, 700, 0);
  addRoad(0, 0, 11, 700, Math.PI / 2);
  addRoad(-62, -55, 8, 130, 0);
  addRoad(-62, -52, 8, 115, Math.PI / 2);
  addRoad(70, -45, 8, 130, 0);
  addRoad(70, 52, 8, 115, 0);
  addRoad(50, 62, 8, 105, Math.PI / 2);
  // Sunset Valley Home Plots West Access Roads
  addRoad(-215, -60, 8.5, 190, 0);
  addRoad(-215, -60, 8.5, 140, Math.PI / 2);
  // South Highway Scenic Loop
  addRoad(0, 240, 12, 110, Math.PI / 2);

  // Stone Arch Bridge over West River (at x = -152, z = 0)
  const bridgeDeck = new THREE.Mesh(track(new THREE.BoxGeometry(36, 0.5, 12)), warmStoneMat);
  bridgeDeck.position.set(-152, 0.05, 0);
  bridgeDeck.receiveShadow = true;
  const railN = new THREE.Mesh(track(new THREE.BoxGeometry(36, 1.0, 0.5)), warmStoneMat);
  railN.position.set(-152, 0.7, -5.8);
  const railS = railN.clone();
  railS.position.z = 5.8;
  root.add(bridgeDeck, railN, railS);
  physics.addStaticBox('bridge-n', -152, 0.7, -5.8, 36, 1.2, 0.6);
  physics.addStaticBox('bridge-s', -152, 0.7, 5.8, 36, 1.2, 0.6);

  // Central Cobblestone Fountain Plaza (0, 0)
  const plazaMat = track(
    new THREE.MeshStandardMaterial({
      map: cobbleTex,
      roughness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const plazaDisc = new THREE.Mesh(track(new THREE.CylinderGeometry(21, 21.5, 0.14, 32)), plazaMat);
  plazaDisc.position.set(0, 0.02, 0);
  plazaDisc.receiveShadow = true;
  root.add(plazaDisc);

  // Stone Fountain Centerpiece (Multi-part composite)
  const fountainGroup = new THREE.Group();
  const basinOuter = new THREE.Mesh(track(new THREE.CylinderGeometry(4.4, 4.8, 0.85, 24)), warmStoneMat);
  basinOuter.position.y = 0.42;
  basinOuter.castShadow = true;
  basinOuter.receiveShadow = true;
  const basinWater = new THREE.Mesh(track(new THREE.CylinderGeometry(3.9, 3.9, 0.7, 24)), poolWaterMat);
  basinWater.position.y = 0.48;
  const pedestal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 1.3, 2.2, 16)), warmStoneMat);
  pedestal.position.y = 1.4;
  pedestal.castShadow = true;
  const topBowl = new THREE.Mesh(track(new THREE.CylinderGeometry(2.1, 0.8, 0.55, 20)), warmStoneMat);
  topBowl.position.y = 2.6;
  topBowl.castShadow = true;
  const spire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.5, 1.1, 12)), warmStoneMat);
  spire.position.y = 3.2;
  fountainGroup.add(basinOuter, basinWater, pedestal, topBowl, spire);

  const fountainJets: THREE.Mesh[] = [];
  const jetGeo = track(new THREE.SphereGeometry(0.26, 10, 10));
  const jetMat = track(
    new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      roughness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
  );
  for (let i = 0; i < 6; i++) {
    const j = new THREE.Mesh(jetGeo, jetMat);
    j.position.set(Math.cos((i / 6) * Math.PI * 2) * 0.9, 3.7, Math.sin((i / 6) * Math.PI * 2) * 0.9);
    fountainGroup.add(j);
    fountainJets.push(j);
  }
  root.add(fountainGroup);
  physics.addStaticBox('central-fountain', 0, 1.8, 0, 8.6, 3.6, 8.6);

  // Helper: Composite Architectural Building Builder
  const addSignboard = (
    parent: THREE.Object3D,
    title: string,
    subtitle: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    rotY = 0,
    accent = '#10b981',
  ): THREE.Mesh => {
    const tex = track(createSignTexture(title, subtitle, accent));
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    parent.add(mesh);
    return mesh;
  };

  const addBuilding = (opts: {
    id: string;
    name: string;
    subtitle: string;
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: string;
    roofColor: string;
    accent?: string;
    pitchedRoof?: boolean;
    signSide?: 'south' | 'north' | 'west' | 'east';
  }) => {
    const g = new THREE.Group();
    g.position.set(opts.x, 0, opts.z);

    const wallMat = track(new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.82 }));
    const roofMat = track(new THREE.MeshStandardMaterial({ color: opts.roofColor, roughness: 0.65 }));

    // Stone foundation plinth
    const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(opts.w + 0.5, 0.5, opts.d + 0.5)), warmStoneMat);
    plinth.position.y = 0.25;
    plinth.receiveShadow = true;
    g.add(plinth);

    // Main structural shell
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(opts.w, opts.h, opts.d)), wallMat);
    body.position.y = 0.5 + opts.h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Roof silhouette
    if (opts.pitchedRoof) {
      const roofH = Math.min(4.2, opts.w * 0.32);
      const roof = new THREE.Mesh(
        track(new THREE.ConeGeometry(Math.max(opts.w, opts.d) * 0.76, roofH, 4)),
        roofMat,
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.5 + opts.h + roofH * 0.5;
      roof.castShadow = true;
      g.add(roof);
    } else {
      const cornice = new THREE.Mesh(
        track(new THREE.BoxGeometry(opts.w + 0.7, 0.55, opts.d + 0.7)),
        roofMat,
      );
      cornice.position.y = 0.5 + opts.h + 0.25;
      cornice.castShadow = true;
      g.add(cornice);
    }

    // Front entrance canopy & glass door
    const door = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 2.8, 0.25)), darkMetalMat);
    door.position.set(0, 1.9, opts.d * 0.5 + 0.06);
    const doorGlass = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 2.3, 0.28)), windowGlowMat);
    doorGlass.position.set(0, 1.95, opts.d * 0.5 + 0.08);
    const awning = new THREE.Mesh(track(new THREE.BoxGeometry(3.8, 0.22, 1.4)), roofMat);
    awning.position.set(0, 3.45, opts.d * 0.5 + 0.65);
    g.add(door, doorGlass, awning);

    // Multi-row architectural windows on front & back
    const floors = Math.max(1, Math.min(4, Math.floor(opts.h / 3.2)));
    const cols = Math.max(2, Math.min(5, Math.floor(opts.w / 3.4)));
    const winGeo = track(new THREE.BoxGeometry(1.4, 1.35, 0.16));
    for (let f = 0; f < floors; f++) {
      const wy = 2.2 + f * 3.1;
      if (wy > opts.h - 0.6) continue;
      for (let c = 0; c < cols; c++) {
        const wx = -opts.w * 0.36 + (cols > 1 ? (c / (cols - 1)) * opts.w * 0.72 : 0);
        if (f === 0 && Math.abs(wx) < 1.9) continue; // Keep door clear
        const wFront = new THREE.Mesh(winGeo, windowGlowMat);
        wFront.position.set(wx, wy, opts.d * 0.5 + 0.04);
        const wBack = new THREE.Mesh(winGeo, windowGlowMat);
        wBack.position.set(wx, wy, -opts.d * 0.5 - 0.04);
        g.add(wFront, wBack);
      }
    }

    // Landmark Signage
    const signW = Math.min(opts.w * 0.82, 8.5);
    const signH = signW * 0.25;
    const signY = Math.min(opts.h - 0.5, 4.8);
    if (opts.signSide === 'west') {
      addSignboard(g, opts.name, opts.subtitle, -opts.w * 0.5 - 0.12, signY, 0, signW, signH, -Math.PI / 2, opts.accent);
    } else if (opts.signSide === 'east') {
      addSignboard(g, opts.name, opts.subtitle, opts.w * 0.5 + 0.12, signY, 0, signW, signH, Math.PI / 2, opts.accent);
    } else {
      addSignboard(g, opts.name, opts.subtitle, 0, signY, opts.d * 0.5 + 0.12, signW, signH, 0, opts.accent);
    }

    root.add(g);
    physics.addStaticBox(opts.id, opts.x, (opts.h + 0.5) * 0.5, opts.z, opts.w + 0.4, opts.h + 1, opts.d + 0.4);
    return g;
  };

  // =========================================================================
  // 3. DISTRICT A: RESIDENTIAL AREA (6 Purchasable Properties + Pools + Gardens)
  // =========================================================================
  const propertySigns = new Map<string, THREE.Mesh>();
  for (const prop of PROPERTIES) {
    const houseGroup = addBuilding({
      id: prop.id,
      name: prop.name,
      subtitle: `${prop.price} GC · Available`,
      x: prop.position.x,
      z: prop.position.z,
      w: prop.size.x,
      h: prop.size.y,
      d: prop.size.z,
      color: prop.color,
      roofColor: prop.roofColor,
      accent: '#10b981',
      pitchedRoof: prop.category !== 'apartment',
    });

    // Yard ownership sign post right near front entrance
    const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8)), timberMat);
    post.position.set(prop.size.x * 0.42, 1.0, prop.size.z * 0.5 + 2.4);
    houseGroup.add(post);
    const yardSign = addSignboard(
      houseGroup,
      prop.name,
      `For Sale · ${prop.price} GC`,
      prop.size.x * 0.42,
      2.1,
      prop.size.z * 0.5 + 2.52,
      3.0,
      0.78,
      0,
      '#10b981',
    );
    propertySigns.set(prop.id, yardSign);

    // Private Swimming Pool for Villas & Manor
    if (prop.hasPool) {
      const poolDeck = new THREE.Mesh(track(new THREE.BoxGeometry(6.8, 0.18, 4.4)), concreteMat);
      poolDeck.position.set(-prop.size.x * 0.5 - 4.2, 0.09, 0);
      const poolWater = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.22, 3.2)), poolWaterMat);
      poolWater.position.set(-prop.size.x * 0.5 - 4.2, 0.11, 0);
      houseGroup.add(poolDeck, poolWater);
    }
  }

  // =========================================================================
  // 4. DISTRICT B: COMMERCIAL AREA (Mall, Cafes, Restaurants, Hotel, Bank, ATMs)
  // =========================================================================
  addBuilding({
    id: 'bldg-mall',
    name: 'GRAND VALLEY MALL',
    subtitle: 'Shopping · Fashion · Food Court',
    x: 72,
    z: -2,
    w: 24,
    h: 11,
    d: 18,
    color: '#e2e8f0',
    roofColor: '#1e293b',
    accent: '#f59e0b',
    signSide: 'west',
  });
  addBuilding({
    id: 'bldg-bank',
    name: 'GREEN VALLEY BANK',
    subtitle: 'Green Coins Reserve & ATMs',
    x: 70,
    z: -36,
    w: 15,
    h: 9,
    d: 12,
    color: '#d9e0e6',
    roofColor: '#0f172a',
    accent: '#10b981',
  });

  for (const biz of BUSINESSES) {
    const dims: Record<string, [number, number, number, string, string]> = {
      cafe: [11, 5.5, 9, '#f3e8d2', '#78350f'],
      restaurant: [13, 6.2, 10, '#e6ede8', '#14532d'],
      supermarket: [18, 7.0, 13, '#f1f5f9', '#1d4ed8'],
      hotel: [16, 17.5, 13, '#f4efe6', '#312e81'],
      gaming: [16, 7.8, 12, '#1e293b', '#7c3aed'],
    };
    const [w, h, d, col, roof] = dims[biz.category] || [12, 6, 10, '#e5e7eb', '#334155'];
    addBuilding({
      id: biz.id,
      name: biz.name.toUpperCase(),
      subtitle: `Business · +${biz.payout} GC`,
      x: biz.position.x,
      z: biz.position.z,
      w,
      h,
      d,
      color: col,
      roofColor: roof,
      accent: '#f59e0b',
    });
  }

  // Interactive ATMs
  const atmMat = track(new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.35, metalness: 0.55 }));
  const atmScreenMat = track(
    new THREE.MeshStandardMaterial({ color: '#34d399', emissive: '#10b981', emissiveIntensity: 0.9 }),
  );
  for (const atm of ATM_LOCATIONS) {
    const ag = new THREE.Group();
    ag.position.set(atm.position.x, 0, atm.position.z);
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 2.2, 0.85)), atmMat);
    body.position.y = 1.1;
    body.castShadow = true;
    const screen = new THREE.Mesh(track(new THREE.BoxGeometry(0.74, 0.52, 0.1)), atmScreenMat);
    screen.position.set(0, 1.45, 0.44);
    ag.add(body, screen);
    root.add(ag);
    physics.addStaticBox(atm.id, atm.position.x, 1.1, atm.position.z, 1.2, 2.2, 0.9);
  }

  // =========================================================================
  // 5. DISTRICT C: ENTERTAINMENT, WATER PARK, ADVENTURE, CAMPING & BEACH RESORT
  // =========================================================================
  addBuilding({
    id: 'bldg-cinema',
    name: 'STARLIGHT CINEMA',
    subtitle: 'IMAX Theatre & Lounge',
    x: -14,
    z: 68,
    w: 17,
    h: 9,
    d: 13,
    color: '#292524',
    roofColor: '#991b1b',
    accent: '#ef4444',
  });

  // Splash Water Theme Park (Pool + Twin Blue Slides)
  const waterParkGroup = new THREE.Group();
  waterParkGroup.position.set(22, 0, 108);
  const wpDeck = new THREE.Mesh(track(new THREE.BoxGeometry(22, 0.25, 16)), concreteMat);
  wpDeck.position.y = 0.12;
  const wpPool = new THREE.Mesh(track(new THREE.BoxGeometry(18, 0.3, 12)), poolWaterMat);
  wpPool.position.y = 0.14;
  const slideTower = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 8.5, 3.2)), timberMat);
  slideTower.position.set(-7.5, 4.25, -4);
  slideTower.castShadow = true;
  const slideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.2, 8.0, -3.5),
    new THREE.Vector3(-1.5, 5.5, -1.0),
    new THREE.Vector3(2.0, 2.8, 1.5),
    new THREE.Vector3(5.0, 0.7, 2.0),
  ]);
  const slideMesh = new THREE.Mesh(
    track(new THREE.TubeGeometry(slideCurve, 24, 0.65, 10, false)),
    track(new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.22, metalness: 0.1 })),
  );
  slideMesh.castShadow = true;
  addSignboard(waterParkGroup, 'SPLASH WATER PARK', 'Slides · Wave Pool', 0, 4.5, -8.2, 8, 2, 0, '#0ea5e9');
  waterParkGroup.add(wpDeck, wpPool, slideTower, slideMesh);
  root.add(waterParkGroup);
  physics.addStaticBox('waterpark-tower', 14.5, 4.2, 104, 3.4, 8.5, 3.4);

  // Pine Ridge Adventure Park & Lakeside Camping Zone
  const advGroup = new THREE.Group();
  advGroup.position.set(-10, 0, 114);
  const climbWall = new THREE.Mesh(
    track(new THREE.ConeGeometry(4.2, 10, 6)),
    track(new THREE.MeshStandardMaterial({ color: '#78716c', roughness: 0.92 })),
  );
  climbWall.position.set(0, 5, 0);
  climbWall.castShadow = true;
  advGroup.add(climbWall);

  // Camping Tents + Campfire
  const tentMat1 = track(new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.85 }));
  const tentMat2 = track(new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.85 }));
  const tentPositions: [number, number, THREE.Material][] = [
    [-12, -4, tentMat1],
    [-17, 2, tentMat2],
    [-9, 6, tentMat1],
  ];
  for (const [tx, tz, mat] of tentPositions) {
    const tent = new THREE.Mesh(track(new THREE.ConeGeometry(2.2, 2.4, 4)), mat);
    tent.position.set(tx, 1.2, tz);
    tent.rotation.y = Math.PI / 4;
    tent.castShadow = true;
    advGroup.add(tent);
  }
  const fireRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.9, 0.2, 8, 12)), warmStoneMat);
  fireRing.rotation.x = Math.PI / 2;
  fireRing.position.set(-12.5, 0.16, 1.2);
  const campfireGlow = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.55, 1.15, 7)),
    track(
      new THREE.MeshStandardMaterial({
        color: '#fb923c',
        emissive: '#f97316',
        emissiveIntensity: 2.0,
      }),
    ),
  );
  campfireGlow.position.set(-12.5, 0.65, 1.2);
  advGroup.add(fireRing, campfireGlow);
  root.add(advGroup);
  physics.addStaticBox('adventure-rock', -10, 5, 114, 7.5, 10, 7.5);

  // Golden Sands Beach Resort: Wooden Pier, Umbrellas & Sailboat
  const pierGroup = new THREE.Group();
  const pierDeck = new THREE.Mesh(track(new THREE.BoxGeometry(30, 0.35, 6.2)), timberMat);
  pierDeck.position.set(-58, 0.35, 82.5);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  pierGroup.add(pierDeck);
  for (let px = -70; px <= -44; px += 5.2) {
    for (const pz of [79.8, 85.2]) {
      const piling = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8)), timberMat);
      piling.position.set(px, -0.5, pz);
      pierGroup.add(piling);
    }
  }
  // Beach Umbrellas
  const umbColors = ['#ef4444', '#0ea5e9', '#f59e0b'];
  for (let i = 0; i < 3; i++) {
    const ux = -36 - i * 6;
    const uz = 70 + i * 2;
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8)), darkMetalMat);
    pole.position.set(ux, 1.3, uz);
    const canopy = new THREE.Mesh(
      track(new THREE.ConeGeometry(1.9, 0.75, 8)),
      track(new THREE.MeshStandardMaterial({ color: umbColors[i], roughness: 0.7 })),
    );
    canopy.position.set(ux, 2.6, uz);
    canopy.castShadow = true;
    pierGroup.add(pole, canopy);
  }
  root.add(pierGroup);

  // Animated Sailboat on the Lake
  const sailboat = new THREE.Group();
  sailboat.position.set(-82, -0.25, 96);
  const hull = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.4, 0.85, 6.2)),
    track(new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 })),
  );
  hull.position.y = 0.35;
  const mast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.1, 6.8, 8)), timberMat);
  mast.position.y = 3.8;
  const sail = new THREE.Mesh(
    track(new THREE.ConeGeometry(2.2, 5.2, 3)),
    track(new THREE.MeshStandardMaterial({ color: '#fef9c3', roughness: 0.8, side: THREE.DoubleSide })),
  );
  sail.position.set(0.1, 4.0, 0.6);
  sail.scale.set(0.1, 1, 1);
  sailboat.add(hull, mast, sail);
  root.add(sailboat);

  // =========================================================================
  // 6. DISTRICT D: SPORTS COMPLEX (Cricket Stadium, Football, Basketball, Gym, Pool)
  // =========================================================================
  const stadiumGroup = new THREE.Group();
  stadiumGroup.position.set(92, 0, -96);
  const cricketTurf = new THREE.Mesh(
    track(new THREE.CylinderGeometry(24, 24, 0.14, 32)),
    track(new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.88 })),
  );
  cricketTurf.position.y = 0.08;
  cricketTurf.receiveShadow = true;
  const pitchStrip = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.4, 0.16, 12)),
    track(new THREE.MeshStandardMaterial({ color: '#d6bfa2', roughness: 0.92 })),
  );
  pitchStrip.position.y = 0.1;
  // Curved Bowl Stands (4 arc segments with wide entry gaps)
  const standMat = track(new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.72 }));
  const seatMat = track(new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.6 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const stand = new THREE.Mesh(track(new THREE.BoxGeometry(18, 6.5, 5.5)), standMat);
    const sx = Math.cos(a) * 26;
    const sz = Math.sin(a) * 26;
    stand.position.set(sx, 3.25, sz);
    stand.rotation.y = -a + Math.PI / 2;
    stand.castShadow = true;
    const roof = new THREE.Mesh(track(new THREE.BoxGeometry(18.5, 0.5, 6.8)), seatMat);
    roof.position.set(sx, 6.8, sz);
    roof.rotation.y = -a + Math.PI / 2;
    stadiumGroup.add(stand, roof);

    // Floodlight Mast
    const mastPole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.3, 0.42, 16, 8)), darkMetalMat);
    mastPole.position.set(Math.cos(a) * 30, 8, Math.sin(a) * 30);
    const lightHead = new THREE.Mesh(track(new THREE.BoxGeometry(2.8, 1.2, 0.6)), lampBulbMat);
    lightHead.position.set(Math.cos(a) * 29.5, 16.2, Math.sin(a) * 29.5);
    lightHead.lookAt(0, 0, 0);
    stadiumGroup.add(mastPole, lightHead);
  }
  addSignboard(stadiumGroup, 'VALLEY CRICKET STADIUM', 'Sports Complex', 0, 8.2, 26.5, 10, 2.4, 0, '#22c55e');
  stadiumGroup.add(cricketTurf, pitchStrip);
  root.add(stadiumGroup);

  // Football Ground + Goalposts
  const footballField = new THREE.Mesh(
    track(new THREE.BoxGeometry(24, 0.14, 15)),
    track(new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9 })),
  );
  footballField.position.set(48, 0.07, -104);
  footballField.receiveShadow = true;
  root.add(footballField);
  const goalMat = track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }));
  for (const gx of [36.5, 59.5]) {
    const crossbar = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.18, 4.4)), goalMat);
    crossbar.position.set(gx, 2.3, -104);
    const postL = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 2.3, 0.18)), goalMat);
    postL.position.set(gx, 1.15, -106.1);
    const postR = postL.clone();
    postR.position.z = -101.9;
    root.add(crossbar, postL, postR);
  }

  // Basketball Court + Fitness Gym
  const bballCourt = new THREE.Mesh(
    track(new THREE.BoxGeometry(14, 0.16, 9)),
    track(new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.8 })),
  );
  bballCourt.position.set(48, 0.08, -82);
  root.add(bballCourt);

  addBuilding({
    id: 'bldg-gym',
    name: 'APEX FITNESS GYM',
    subtitle: 'Gym & Olympic Pool',
    x: 48,
    z: -62,
    w: 15,
    h: 7.2,
    d: 11,
    color: '#334155',
    roofColor: '#0ea5e9',
    accent: '#38bdf8',
  });

  // =========================================================================
  // 7. DISTRICT E: EDUCATION & HEALTH (Hospital, School, College, Library)
  // =========================================================================
  const hospital = addBuilding({
    id: 'bldg-hospital',
    name: 'CENTRAL HOSPITAL',
    subtitle: '24/7 Emergency & Clinic',
    x: 18,
    z: -98,
    w: 18,
    h: 11.5,
    d: 13,
    color: '#f8fafc',
    roofColor: '#e11d48',
    accent: '#f43f5e',
  });
  // Iconic Red Cross emblem on Hospital
  const crossMat = track(new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 0.5 }));
  const crossV = new THREE.Mesh(track(new THREE.BoxGeometry(0.85, 2.8, 0.25)), crossMat);
  crossV.position.set(0, 9.2, 6.65);
  const crossH = new THREE.Mesh(track(new THREE.BoxGeometry(2.8, 0.85, 0.25)), crossMat);
  crossH.position.set(0, 9.2, 6.65);
  hospital.add(crossV, crossH);

  addBuilding({
    id: 'bldg-school',
    name: 'GREEN VALLEY SCHOOL',
    subtitle: 'Primary & High School',
    x: -18,
    z: -96,
    w: 17,
    h: 7.8,
    d: 12,
    color: '#fef3c7',
    roofColor: '#b45309',
    accent: '#f59e0b',
    pitchedRoof: true,
  });
  addBuilding({
    id: 'bldg-college',
    name: 'VALLEY COLLEGE',
    subtitle: 'Science & Arts Campus',
    x: -18,
    z: -124,
    w: 20,
    h: 9.5,
    d: 13,
    color: '#e7e5e4',
    roofColor: '#1e3a5f',
    accent: '#38bdf8',
  });
  addBuilding({
    id: 'bldg-library',
    name: 'CIVIC LIBRARY',
    subtitle: 'Archives & Study Hall',
    x: 16,
    z: -124,
    w: 14,
    h: 7.2,
    d: 11,
    color: '#e2dcd1',
    roofColor: '#44403c',
    accent: '#a78bfa',
  });

  // =========================================================================
  // 8. DISTRICT F: TRANSPORT HUB (Airport, SkyCab Pad, Vehicle Showroom, Bus Station)
  // =========================================================================
  addBuilding({
    id: 'bldg-showroom',
    name: 'APEX VEHICLE SHOWROOM',
    subtitle: 'EV · Sports · SUVs · Motos',
    x: 52,
    z: 56,
    w: 18,
    h: 7.4,
    d: 12,
    color: '#cbd5e1',
    roofColor: '#0f172a',
    accent: '#ef4444',
  });
  addBuilding({
    id: 'bldg-bus-station',
    name: 'CENTRAL BUS TERMINAL',
    subtitle: 'Green Valley Transit',
    x: 42,
    z: 96,
    w: 15,
    h: 5.5,
    d: 10,
    color: '#e2e8f0',
    roofColor: '#0284c7',
    accent: '#0ea5e9',
  });

  // Green Valley Airport Terminal + Control Tower + Runway + SkyCab Pad
  addBuilding({
    id: 'bldg-airport',
    name: 'GREEN VALLEY AIRPORT',
    subtitle: 'Terminal 1 & Hangar',
    x: 114,
    z: 108,
    w: 22,
    h: 8.5,
    d: 14,
    color: '#e2e8f0',
    roofColor: '#1e293b',
    accent: '#8b5cf6',
  });
  const towerShaft = new THREE.Mesh(track(new THREE.CylinderGeometry(2.2, 2.8, 17, 12)), concreteMat);
  towerShaft.position.set(130, 8.5, 108);
  towerShaft.castShadow = true;
  const towerCab = new THREE.Mesh(track(new THREE.CylinderGeometry(4.2, 3.0, 3.6, 12)), windowGlowMat);
  towerCab.position.set(130, 18.2, 108);
  const towerCap = new THREE.Mesh(track(new THREE.CylinderGeometry(4.4, 4.4, 0.6, 12)), darkMetalMat);
  towerCap.position.set(130, 20.3, 108);
  root.add(towerShaft, towerCab, towerCap);
  physics.addStaticBox('airport-tower', 130, 10, 108, 6, 20, 6);

  // Runway Strip
  const runway = new THREE.Mesh(
    track(new THREE.PlaneGeometry(14, 90)),
    track(
      new THREE.MeshStandardMaterial({
        color: '#272c34',
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    ),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(126, 0.05, 52);
  root.add(runway);

  // Illuminated SkyCab Flying Taxi Pad
  const skyPad = new THREE.Mesh(
    track(new THREE.CylinderGeometry(7.2, 7.6, 0.28, 24)),
    darkMetalMat,
  );
  skyPad.position.set(92, 0.14, 86);
  const skyRing = new THREE.Mesh(
    track(new THREE.RingGeometry(5.6, 6.2, 32)),
    track(
      new THREE.MeshBasicMaterial({
        color: '#facc15',
        side: THREE.DoubleSide,
      }),
    ),
  );
  skyRing.rotation.x = -Math.PI / 2;
  skyRing.position.set(92, 0.3, 86);
  root.add(skyPad, skyRing);

  // South Highway Overlook Plaza & Sunset Valley Welcome Arch
  const overlookDisc = new THREE.Mesh(track(new THREE.CylinderGeometry(16, 16.5, 0.16, 28)), plazaMat);
  overlookDisc.position.set(0, 0.03, 240);
  overlookDisc.receiveShadow = true;
  root.add(overlookDisc);
  const archL = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 6.5, 1.1)), warmStoneMat);
  archL.position.set(-6.5, 3.25, 252);
  const archR = archL.clone();
  archR.position.x = 6.5;
  const archTop = new THREE.Mesh(track(new THREE.BoxGeometry(14.5, 1.2, 1.4)), darkMetalMat);
  archTop.position.set(0, 6.8, 252);
  root.add(archL, archR, archTop);
  addSignboard(root, 'EMERALD GRAND OVERLOOK', 'South Valley Highway · 840m World', 0, 6.8, 251.2, 11.5, 2.2, Math.PI, '#14b8a6');

  // Sunset Valley Home Plots Entrance Sign
  const svPostL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.18, 0.22, 4.2, 8)), timberMat);
  svPostL.position.set(-182, 2.1, -10);
  const svPostR = svPostL.clone();
  svPostR.position.z = -18;
  root.add(svPostL, svPostR);
  addSignboard(root, 'SUNSET VALLEY HOME PLOTS', 'Build Your Custom 3D Home Here', -182, 3.6, -14, 7.6, 1.9, Math.PI / 2, '#f472b6');

  // =========================================================================
  // 9. INSTANCED FOLIAGE (540 Stylized Multi-Tier Trees + Long Highway Lamps)
  // =========================================================================
  const treeCoords: [number, number, number][] = [];
  const isClearForTree = (tx: number, tz: number): boolean => {
    const h = groundHeightAt(tx, tz);
    if (h < 0.0 || h > 16) return false;
    // Keep long highways, plaza, Sunset Valley roads, overlook, and airport runway clear
    if (Math.abs(tx) < 12 || Math.abs(tz) < 12) return false;
    if (Math.hypot(tx, tz) < 25) return false;
    if (Math.hypot(tx, tz - 240) < 22) return false;
    if (Math.abs(tx + 215) < 12 && tz > -165 && tz < 45) return false;
    if (Math.abs(tz + 60) < 12 && tx > -295 && tx < -135) return false;
    if (tx > 112 && tx < 142 && tz > 4 && tz < 104) return false;
    for (const box of physics.colliders) {
      if (tx >= box.minX - 4.5 && tx <= box.maxX + 4.5 && tz >= box.minZ - 4.5 && tz <= box.maxZ + 4.5) {
        return false;
      }
    }
    return true;
  };

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let attempt = 0; attempt < 1800 && treeCoords.length < 540; attempt++) {
    const tx = (rand() - 0.5) * 740;
    const tz = (rand() - 0.5) * 740;
    if (isClearForTree(tx, tz)) {
      treeCoords.push([tx, groundHeightAt(tx, tz), tz]);
    }
  }

  const trunkGeo = track(new THREE.CylinderGeometry(0.24, 0.42, 2.4, 7));
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: '#6b4c35', roughness: 0.92 }));
  const canopy1Geo = track(new THREE.ConeGeometry(2.1, 3.6, 7));
  canopy1Geo.translate(0, 3.8, 0);
  const canopy2Geo = track(new THREE.ConeGeometry(1.5, 2.8, 7));
  canopy2Geo.translate(0, 5.7, 0);
  const canopyMat = track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 }));

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
  const canopy1Inst = new THREE.InstancedMesh(canopy1Geo, canopyMat, treeCoords.length);
  const canopy2Inst = new THREE.InstancedMesh(canopy2Geo, canopyMat, treeCoords.length);
  trunkInst.castShadow = true;
  canopy1Inst.castShadow = true;
  canopy1Inst.receiveShadow = true;
  canopy2Inst.castShadow = true;

  const dummy = new THREE.Object3D();
  const foliagePalette = [
    new THREE.Color('#2f7d44'),
    new THREE.Color('#3b8c4e'),
    new THREE.Color('#4a9b56'),
    new THREE.Color('#28693b'),
    new THREE.Color('#5a9e4b'),
  ];

  for (let i = 0; i < treeCoords.length; i++) {
    const [tx, ty, tz] = treeCoords[i];
    const scale = 0.85 + rand() * 0.35; // +-15% variation
    dummy.position.set(tx, ty, tz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale * (0.9 + rand() * 0.25), scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    canopy1Inst.setMatrixAt(i, dummy.matrix);
    canopy2Inst.setMatrixAt(i, dummy.matrix);

    const col = foliagePalette[i % foliagePalette.length];
    canopy1Inst.setColorAt(i, col);
    canopy2Inst.setColorAt(i, col.clone().offsetHSL(0, 0.02, 0.04));
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  canopy1Inst.instanceMatrix.needsUpdate = true;
  canopy2Inst.instanceMatrix.needsUpdate = true;
  if (canopy1Inst.instanceColor) canopy1Inst.instanceColor.needsUpdate = true;
  if (canopy2Inst.instanceColor) canopy2Inst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopy1Inst.computeBoundingSphere();
  canopy2Inst.computeBoundingSphere();
  root.add(trunkInst, canopy1Inst, canopy2Inst);

  // Street Lamps along Long Main Highways
  const lampPositions: [number, number][] = [];
  for (let d = -260; d <= 260; d += 32) {
    if (Math.abs(d) < 24) continue;
    lampPositions.push([7.0, d], [-7.0, d], [d, 7.0], [d, -7.0]);
  }
  const poleGeo = track(new THREE.CylinderGeometry(0.09, 0.14, 5.2, 8));
  poleGeo.translate(0, 2.6, 0);
  const bulbGeo = track(new THREE.SphereGeometry(0.32, 10, 10));
  bulbGeo.translate(0, 5.35, 0);
  const poleInst = new THREE.InstancedMesh(poleGeo, darkMetalMat, lampPositions.length);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, lampBulbMat, lampPositions.length);
  for (let i = 0; i < lampPositions.length; i++) {
    const [lx, lz] = lampPositions[i];
    dummy.position.set(lx, 0, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);
    bulbInst.setMatrixAt(i, dummy.matrix);
  }
  poleInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  root.add(poleInst, bulbInst);

  // =========================================================================
  // 10. DRIFTING CLOUDS & RAIN WEATHER PARTICLES
  // =========================================================================
  const cloudsGroup = new THREE.Group();
  const cloudMat = track(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const puffGeo = track(new THREE.SphereGeometry(6, 10, 8));
  for (let i = 0; i < 28; i++) {
    const cg = new THREE.Group();
    cg.position.set((rand() - 0.5) * 680, 68 + rand() * 28, (rand() - 0.5) * 680);
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set((p - 1) * 5.2, (p % 2) * 1.4, (rand() - 0.5) * 2.5);
      puff.scale.set(1.3, 0.58, 0.95);
      cg.add(puff);
    }
    cloudsGroup.add(cg);
  }
  root.add(cloudsGroup);

  // Rain Streak Particle Field (toggled when weatherMode === 'rain')
  const rainCount = 900;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 120;
    rainPos[i * 3 + 1] = Math.random() * 42;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  const rainGeo = track(new THREE.BufferGeometry());
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = track(
    new THREE.PointsMaterial({
      color: '#bae6fd',
      size: 0.28,
      transparent: true,
      opacity: 0.65,
    }),
  );
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = false;
  rainPoints.frustumCulled = false;
  root.add(rainPoints);

  // =========================================================================
  // 11. FRIENDLY WORLD NPCS & ACTIVE MISSION BEACON
  // =========================================================================
  const npcRigs: { id: string; rig: CharacterRig; baseRotY: number }[] = [];
  for (const npc of NPCS) {
    const rig = buildCharacterRig({
      gender: npc.id === 'npc-barista-maya' || npc.id === 'npc-dr-sara' ? 'female' : 'male',
      skinTone: npc.skinTone,
      hairStyle: npc.id === 'npc-barista-maya' || npc.id === 'npc-dr-sara' ? 'ponytail' : 'short',
      hairColor: npc.hairColor,
      shirtStyle: 'jacket',
      shirtColor: npc.shirtColor,
      pantsColor: npc.pantsColor,
      shoeColor: '#f1f5f9',
      accessory: npc.id === 'npc-mayor-lin' ? 'glasses' : 'none',
    });
    rig.root.position.set(npc.position.x, groundHeightAt(npc.position.x, npc.position.z), npc.position.z);
    rig.root.rotation.y = npc.rotY;
    const plate = createNameplateSprite(npc.name, npc.role, undefined, '#f59e0b');
    plate.position.y = 2.45;
    rig.root.add(plate);
    root.add(rig.root);
    npcRigs.push({ id: npc.id, rig, baseRotY: npc.rotY });
  }

  // Golden Mission Waypoint Beacon
  const missionBeacon = new THREE.Group();
  const beaconBeam = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.45, 0.9, 28, 16, 1, true)),
    track(
      new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  beaconBeam.position.y = 14;
  const beaconRing = new THREE.Mesh(
    track(new THREE.RingGeometry(1.4, 2.0, 24)),
    track(
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.14;
  missionBeacon.add(beaconBeam, beaconRing);
  root.add(missionBeacon);

  const dispose = () => {
    npcRigs.forEach((n) => n.rig.dispose());
    disposables.forEach((d) => d.dispose());
  };

  return {
    root,
    waterMesh,
    waterTexture,
    fountainJets,
    cloudsGroup,
    rainPoints,
    lampBulbMat,
    windowGlowMat,
    poolWaterMat,
    npcRigs,
    missionBeacon,
    propertySigns,
    sailboat,
    campfireGlow,
    dispose,
  };
}

/**
 * Dynamically builds a custom player-built or Admin-built 3D residence anywhere in Green Valley.
 */
export function buildCustomHomeMesh(
  home: CustomHomeDef,
  windowGlowMat: THREE.MeshStandardMaterial,
  poolWaterMat: THREE.MeshStandardMaterial,
): { group: THREE.Group; size: { x: number; y: number; z: number }; dispose: () => void } {
  const plan = CUSTOM_HOME_PLANS.find((p) => p.style === home.style) || CUSTOM_HOME_PLANS[1];
  const { x: w, y: h, z: d } = plan.size;
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(res: T): T => {
    disposables.push(res);
    return res;
  };

  const group = new THREE.Group();
  group.position.set(home.x, home.y, home.z);

  const wallMat = track(new THREE.MeshStandardMaterial({ color: home.wallColor, roughness: 0.8 }));
  const roofMat = track(new THREE.MeshStandardMaterial({ color: home.roofColor, roughness: 0.62 }));
  const stoneMat = track(new THREE.MeshStandardMaterial({ color: '#a89f91', roughness: 0.9 }));
  const darkMetal = track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.68 }));
  const deckMat = track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85 }));

  // Foundation plinth
  const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6)), stoneMat);
  plinth.position.y = 0.25;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Main architectural shell
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), wallMat);
  body.position.y = 0.5 + h * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof style: pitched for cabin/villa, architectural cornice + balcony terrace for modern/manor
  if (home.style === 'cabin' || home.style === 'villa') {
    const roofH = Math.min(4.0, w * 0.3);
    const roof = new THREE.Mesh(
      track(new THREE.ConeGeometry(Math.max(w, d) * 0.76, roofH, 4)),
      roofMat,
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.5 + h + roofH * 0.5;
    roof.castShadow = true;
    group.add(roof);
  } else {
    const cornice = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.9, 0.55, d + 0.9)), roofMat);
    cornice.position.y = 0.5 + h + 0.25;
    cornice.castShadow = true;
    group.add(cornice);
    if (home.style === 'manor') {
      const upperSuite = new THREE.Mesh(
        track(new THREE.BoxGeometry(w * 0.55, 3.2, d * 0.55)),
        wallMat,
      );
      upperSuite.position.y = 0.5 + h + 2.1;
      upperSuite.castShadow = true;
      const upperCap = new THREE.Mesh(
        track(new THREE.BoxGeometry(w * 0.6, 0.45, d * 0.6)),
        roofMat,
      );
      upperCap.position.y = 0.5 + h + 3.85;
      group.add(upperSuite, upperCap);
    }
  }

  // Front entrance door & canopy
  const door = new THREE.Mesh(track(new THREE.BoxGeometry(2.3, 2.8, 0.25)), darkMetal);
  door.position.set(0, 1.9, d * 0.5 + 0.06);
  const doorGlass = new THREE.Mesh(track(new THREE.BoxGeometry(1.8, 2.3, 0.28)), windowGlowMat);
  doorGlass.position.set(0, 1.95, d * 0.5 + 0.08);
  const canopy = new THREE.Mesh(track(new THREE.BoxGeometry(3.8, 0.22, 1.5)), roofMat);
  canopy.position.set(0, 3.45, d * 0.5 + 0.7);
  group.add(door, doorGlass, canopy);

  // Windows front & back
  const floors = Math.max(1, Math.min(3, Math.floor(h / 3.2)));
  const cols = Math.max(2, Math.min(4, Math.floor(w / 3.5)));
  const winGeo = track(new THREE.BoxGeometry(1.45, 1.35, 0.16));
  for (let f = 0; f < floors; f++) {
    const wy = 2.2 + f * 3.1;
    if (wy > h - 0.6) continue;
    for (let c = 0; c < cols; c++) {
      const wx = -w * 0.35 + (cols > 1 ? (c / (cols - 1)) * w * 0.7 : 0);
      if (f === 0 && Math.abs(wx) < 1.9) continue;
      const wF = new THREE.Mesh(winGeo, windowGlowMat);
      wF.position.set(wx, wy, d * 0.5 + 0.05);
      const wB = new THREE.Mesh(winGeo, windowGlowMat);
      wB.position.set(wx, wy, -d * 0.5 - 0.05);
      group.add(wF, wB);
    }
  }

  // Optional Private Swimming Pool
  if (home.hasPool) {
    const poolDeck = new THREE.Mesh(track(new THREE.BoxGeometry(6.8, 0.18, 4.4)), deckMat);
    poolDeck.position.set(-w * 0.5 - 4.3, 0.09, 0);
    const poolWater = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.22, 3.2)), poolWaterMat);
    poolWater.position.set(-w * 0.5 - 4.3, 0.12, 0);
    group.add(poolDeck, poolWater);
  }

  // Garden bushes / planter boxes flanking entrance
  const bushMat = track(
    new THREE.MeshStandardMaterial({
      color: home.gardenStyle === 'flowers' ? '#ec4899' : home.gardenStyle === 'zen' ? '#14b8a6' : '#22c55e',
      roughness: 0.85,
    }),
  );
  const bushGeo = track(new THREE.SphereGeometry(0.65, 8, 8));
  for (const bx of [-2.4, 2.4]) {
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(bx, 0.65, d * 0.5 + 1.1);
    group.add(bush);
  }

  // Front Yard Nameplate Sign displaying Home Name, Owner Name & @Instagram ID
  const ownerLine = home.ownerInstagram
    ? `${home.ownerName} · @${home.ownerInstagram}`
    : `Owner: ${home.ownerName}`;
  const signPost = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 8)), darkMetal);
  signPost.position.set(w * 0.42, 1.05, d * 0.5 + 2.5);
  const signTex = track(
    createSignTexture(
      home.name,
      home.createdByAdmin ? `★ ${ownerLine}` : ownerLine,
      home.createdByAdmin ? '#f59e0b' : '#10b981',
    ),
  );
  const signMesh = new THREE.Mesh(
    track(new THREE.PlaneGeometry(3.8, 0.96)),
    track(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 })),
  );
  signMesh.position.set(w * 0.42, 2.25, d * 0.5 + 2.62);
  group.add(signPost, signMesh);

  return {
    group,
    size: { x: w + 0.5, y: h + 1.2, z: d + 0.5 },
    dispose: () => {
      disposables.forEach((dItem) => dItem.dispose());
    },
  };
}

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type {
  AnimationState,
  CharacterAppearance,
  HeldItemType,
  InteractablePrompt,
} from '../shared/types.ts';
import {
  ACTIVE_BUILDINGS,
  ATM_LOCATIONS,
  BUSINESSES,
  HIDDEN_CARD_POS,
  MISSIONS,
  NPCS,
  PALACE_VILLAS,
  PROPERTIES,
  WORLD_SPAWN,
  getDistrictAt,
} from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';
import { multiplayer } from '../lib/multiplayer.ts';
import { voiceChat } from '../lib/voiceChat.ts';
import { syncPlayerProgressToFirestore } from '../lib/firebase.ts';
import { playSfx } from '../game/audio.ts';
import {
  detectSoftwareGl,
  scheduleSoftwareAfterDraw,
  setupStudioEnvironment,
} from '../game/glUtils.ts';
import { WorldPhysics } from '../game/physics.ts';
import {
  buildCustomHomeMesh,
  buildCustomShopMesh,
  buildGreenValleyWorld,
  buildPublicBusMesh,
  buildSportsBallMesh,
} from '../game/worldBuilder.ts';
import {
  animateCharacterRig,
  buildCharacterRig,
  setCharacterHeldItem,
  type CharacterRig,
} from '../game/characterMesh.ts';
import { buildVehicleRig, type VehicleRig } from '../game/vehicleMesh.ts';
import {
  createNameplateSprite,
  createSignTexture,
  updateNameplateCanvas,
} from '../game/textures.ts';

export interface MobileInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  jump: boolean;
}

interface WorldViewportProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  onInteractTriggerRef: React.MutableRefObject<(() => void) | null>;
}

interface RemoteVisual {
  uid: string;
  rig: CharacterRig;
  plate: THREE.Sprite;
  appearanceKey: string;
  lastHeldItem: HeldItemType;
  lastDisplayName: string;
  lastInstagramId: string;
  lastChatBubble: string;
  lastVoiceTag: string;
  pos: THREE.Vector3;
  rotY: number;
}

const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _skyDay = new THREE.Color('#84c7f2');
const _skyGolden = new THREE.Color('#f2a66c');
const _skyNight = new THREE.Color('#0c1729');
const _skyCurrent = new THREE.Color();
const _sunDay = new THREE.Color('#fff5e0');
const _sunGolden = new THREE.Color('#ffaa5b');
const _sunNight = new THREE.Color('#7ca3d9');
const _sunCurrent = new THREE.Color();

function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function WorldViewport({
  mobileInputRef,
  onInteractTriggerRef,
}: WorldViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#84c7f2');
    const fog = new THREE.FogExp2('#84c7f2', 0.0018);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      58,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.2,
      960,
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight),
      false,
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const envTex = setupStudioEnvironment(renderer, scene);

    // Outdoor Lighting Rig (Warm Sun Key + Cool Hemisphere Fill)
    const hemiLight = new THREE.HemisphereLight('#c4e4ff', '#4b6b42', 0.85);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff5e0', 1.85);
    sunLight.position.set(85, 115, 65);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 260;
    sunLight.shadow.camera.left = -85;
    sunLight.shadow.camera.right = 85;
    sunLight.shadow.camera.top = 85;
    sunLight.shadow.camera.bottom = -85;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.03;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Initialize Rapier Physics & Green Valley 3D World
    const physics = new WorldPhysics();
    const world = buildGreenValleyWorld(physics, renderer.capabilities.getMaxAnisotropy());
    scene.add(world.root);
    void physics.init();

    // Build Local Player Character Rig
    const initialProfile = useGameStore.getState().profile;
    let localAppearanceKey = `${JSON.stringify(initialProfile?.appearance || {})}|m${initialProfile?.muscleLevel || 0}`;
    let localRig = buildCharacterRig(
      initialProfile?.appearance || {
        gender: 'male',
        skinTone: '#e8be9e',
        hairStyle: 'short',
        hairColor: '#2c221e',
        shirtStyle: 'jacket',
        shirtColor: '#1f7a5c',
        pantsColor: '#283344',
        shoeColor: '#e5e7eb',
        accessory: 'none',
      },
      initialProfile?.muscleLevel || 0,
    );
    let localHeldApplied: HeldItemType = 'none';
    scene.add(localRig.root);

    // Full-Time Automated KSRTC Public Bus + Playable 3D Sports Balls
    const publicBusRig = buildPublicBusMesh();
    publicBusRig.group.visible = false;
    scene.add(publicBusRig.group);

    const footballRig = buildSportsBallMesh('football');
    scene.add(footballRig.mesh);
    const volleyballRig = buildSportsBallMesh('volleyball');
    scene.add(volleyballRig.mesh);

    // Local Actor Physics State
    const startPos = initialProfile?.lastPosition || WORLD_SPAWN;
    const playerState = {
      x: startPos.x,
      y: Math.max(0, physics.getGroundHeight(startPos.x, startPos.z)),
      z: startPos.z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: 0,
      onGround: true,
      peakAirY: 0,
      anim: 'idle' as AnimationState,
      emoteUntil: 0,
      activeEmote: null as AnimationState | null,
      stepTimer: 0,
    };

    // Vehicle Rigs Map
    const vehicleRigs = new Map<string, VehicleRig>();
    const syncVehiclesToScene = () => {
      const vehicles = useGameStore.getState().vehicles;
      for (const veh of Object.values(vehicles)) {
        if (!vehicleRigs.has(veh.id)) {
          const rig = buildVehicleRig(veh);
          rig.root.position.set(veh.x, veh.y, veh.z);
          rig.root.rotation.y = veh.rotY;
          scene.add(rig.root);
          vehicleRigs.set(veh.id, rig);
        }
      }
    };
    syncVehiclesToScene();

    // Local Driving Kinematics State
    const driveState = {
      speed: 0,
      steer: 0,
      y: 0,
      rotY: 0,
    };
    let lastActiveVehicleId: string | null = null;

    // Remote Players Visuals Map
    const remoteVisuals = new Map<string, RemoteVisual>();

    // Dynamic Custom 3D Homes Map (player-built & admin-built)
    const customHomeVisuals = new Map<string, { group: THREE.Group; dispose: () => void }>();

    // Dynamic Custom 3D Player Shops Map (Tea Stalls, Juice Bars, Bakeries, Boutiques, Tech)
    const customShopVisuals = new Map<
      string,
      { group: THREE.Group; shopKey: string; dispose: () => void }
    >();

    // Track property & palace villa sign updates and expandable boundary
    const appliedPropertyOwners = new Map<string, string>();
    const appliedVillaBoards = new Map<string, string>();
    let appliedVillageHalfSize = useGameStore.getState().villageHalfSize;
    physics.setWorldHalfSize(appliedVillageHalfSize);
    world.updateBoundaryRing(appliedVillageHalfSize);

    // Camera Orbit State
    const camState = {
      yaw: 0,
      pitch: 0.34,
      distance: 7.4,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };
    camera.position.set(playerState.x, playerState.y + 4, playerState.z + 8);

    // Keyboard & Pointer Input Listeners
    const keys = new Set<string>();
    const isTypingInInput = () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleInteract = () => {
      const store = useGameStore.getState();
      if (store.activeVehicleId) {
        // Exit vehicle cleanly to side
        const exitX = playerState.x + Math.cos(playerState.rotY) * 2.6;
        const exitZ = playerState.z - Math.sin(playerState.rotY) * 2.6;
        const resolved = physics.resolveHorizontal(exitX, playerState.y, exitZ, 0.5, 1.8);
        playerState.x = resolved.x;
        playerState.z = resolved.z;
        playerState.y = Math.max(playerState.y, physics.getGroundHeight(resolved.x, resolved.z));
        playerState.vy = 0;
        multiplayer.exitVehicle();
        return;
      }

      const prompt = store.nearbyPrompt;
      if (!prompt) return;
      playSfx('click');

      if (prompt.type === 'vehicle') {
        const veh = store.vehicles[prompt.targetId];
        if (!veh) return;
        const isFree = veh.rentPrice <= 0 && veh.buyPrice <= 0;
        const isOwned = Boolean(store.profile?.ownedVehicles.includes(veh.id));
        if (store.isAdmin || isFree || isOwned) {
          multiplayer.enterVehicle(veh.id, 'free');
        } else {
          // Normal player walked up to a paid vehicle -> open Rent vs Buy Permanently dialog
          store.openVehiclePrompt(veh.id);
        }
      } else if (prompt.type === 'work') {
        multiplayer.completeWork(prompt.targetId);
      } else if (prompt.type === 'mission') {
        multiplayer.completeMission(prompt.targetId);
      } else if (prompt.type === 'custom_home') {
        store.setActivePanel('properties');
      } else if (prompt.type === 'property') {
        const ownership = store.worldProperties[prompt.targetId];
        if (!ownership) {
          multiplayer.buyProperty(prompt.targetId);
        } else {
          store.setActivePanel('properties');
        }
      } else if (prompt.type === 'business') {
        const owned = store.profile?.ownedBusinesses.includes(prompt.targetId);
        if (owned) {
          multiplayer.collectBusiness(prompt.targetId);
        } else {
          store.setActivePanel('businesses');
        }
      } else if (prompt.type === 'building') {
        store.openBuildingPanel(prompt.targetId);
      } else if (prompt.type === 'custom_shop') {
        store.openPlayerShopPanel(prompt.targetId);
      } else if (prompt.type === 'public_bus') {
        store.setActivePanel('transit');
      } else if (prompt.type === 'villa') {
        store.openVillaPanel(prompt.targetId);
      } else if (prompt.type === 'hidden_card') {
        multiplayer.collectHiddenGameCard();
      } else if (prompt.type === 'sports_ball') {
        const bId = prompt.targetId === 'volleyball' ? 'volleyball' : 'football';
        multiplayer.kickSportsBall(
          bId,
          Math.sin(playerState.rotY),
          Math.cos(playerState.rotY),
          bId === 'volleyball' ? 16 : 21,
        );
      } else if (prompt.type === 'atm') {
        store.setActivePanel('wallet');
      } else if (prompt.type === 'shop') {
        store.setActivePanel('inventory');
      } else if (prompt.type === 'npc') {
        const npc = NPCS.find((n) => n.id === prompt.targetId);
        if (npc) {
          if (
            npc.id === 'npc-mayor-lin' &&
            store.profile &&
            !store.profile.completedMissions.includes('mis-welcome-plaza')
          ) {
            multiplayer.completeMission('mis-welcome-plaza');
          }
          store.openNpcDialog({
            name: npc.name,
            role: npc.role,
            dialogue: npc.dialogue,
            canHeal: npc.id === 'npc-dr-sara',
          });
        }
      }
    };
    onInteractTriggerRef.current = handleInteract;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        const st = useGameStore.getState();
        if (st.showWorldMapModal) {
          st.setShowWorldMapModal(false);
        } else if (st.activePanel) {
          st.setActivePanel(null);
        } else {
          st.setActivePanel('pause');
        }
        return;
      }
      if (isTypingInInput()) return;

      keys.add(e.code);

      if (e.code === 'KeyE') {
        handleInteract();
      } else if (e.code === 'KeyP') {
        const st = useGameStore.getState();
        st.setActivePanel(st.activePanel === 'phone' ? null : 'phone');
      } else if (e.code === 'KeyK') {
        const balls = useGameStore.getState().sportsBalls;
        for (const bId of ['football', 'volleyball'] as const) {
          const b = balls[bId];
          if (b && Math.hypot(playerState.x - b.x, playerState.z - b.z) < 3.6) {
            multiplayer.kickSportsBall(
              bId,
              Math.sin(playerState.rotY),
              Math.cos(playerState.rotY),
              bId === 'volleyball' ? 16 : 21,
            );
            playSfx('jump');
            break;
          }
        }
      } else if (e.code === 'KeyM') {
        const st = useGameStore.getState();
        st.setShowWorldMapModal(!st.showWorldMapModal);
      } else if (e.code === 'KeyH') {
        useGameStore.getState().toggleHudCollapsed();
      } else if (e.code === 'KeyV') {
        voiceChat.toggleMute();
      } else if (e.code === 'KeyT' || e.code === 'Enter') {
        e.preventDefault();
        useGameStore.getState().setActivePanel('chat');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) {
        camState.dragging = true;
        camState.lastX = e.clientX;
        camState.lastY = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!camState.dragging) return;
      const dx = e.clientX - camState.lastX;
      const dy = e.clientY - camState.lastY;
      camState.lastX = e.clientX;
      camState.lastY = e.clientY;
      camState.yaw -= dx * 0.0055;
      camState.pitch = Math.max(0.08, Math.min(1.15, camState.pitch + dy * 0.0045));
    };

    const onPointerUp = (e: PointerEvent) => {
      camState.dragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    };

    const onWheel = (e: WheelEvent) => {
      camState.distance = Math.max(4.0, Math.min(18.0, camState.distance + e.deltaY * 0.008));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    let lastResizeW = Math.max(1, container.clientWidth);
    let lastResizeH = Math.max(1, container.clientHeight);
    let resizeRafId = 0;
    const onResize = () => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = 0;
        if (!container) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        if (w === lastResizeW && h === lastResizeH) return;
        lastResizeW = w;
        lastResizeH = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // Main Game Loop Variables
    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let prevTime = performance.now();
    let elapsed = 0;
    let dayTime = 0.34; // Start in crisp bright morning-midday light
    let uiSyncTimer = 0;
    let firestoreSaveTimer = 0;
    let fpsFrames = 0;
    let fpsAccum = 0;
    let lastSavedX = playerState.x;
    let lastSavedZ = playerState.z;
    let mingleScreenTimer = 0;
    let hpDrainAccum = 0;
    let lastBallAutoKickMs = 0;

    const rebuildLocalRigIfNeeded = (appearance: CharacterAppearance, muscleLevel = 0) => {
      const nextKey = `${JSON.stringify(appearance)}|m${muscleLevel}`;
      if (nextKey === localAppearanceKey) return;
      localAppearanceKey = nextKey;
      scene.remove(localRig.root);
      localRig.dispose();
      localRig = buildCharacterRig(appearance, muscleLevel);
      localHeldApplied = 'none';
      scene.add(localRig.root);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      elapsed += dt;

      fpsFrames++;
      fpsAccum += dt;
      if (fpsAccum >= 0.75) {
        useGameStore.getState().setFps(Math.round(fpsFrames / fpsAccum));
        fpsFrames = 0;
        fpsAccum = 0;
      }

      const store = useGameStore.getState();

      // 1. Rebuild local rig if customized or gym muscle changed, and sync expandable village boundary
      if (store.profile) {
        rebuildLocalRigIfNeeded(store.profile.appearance, store.profile.muscleLevel || 0);
      }
      if (store.villageHalfSize !== appliedVillageHalfSize) {
        appliedVillageHalfSize = store.villageHalfSize;
        physics.setWorldHalfSize(appliedVillageHalfSize);
        world.updateBoundaryRing(appliedVillageHalfSize);
      }

      // Sync visible held item in player's hand (Tea, Latte, Juice, Snacks, Sports items)
      const activeHeld: HeldItemType =
        store.localHeldItem !== 'none' && Date.now() <= store.localHeldItemUntil
          ? store.localHeldItem
          : 'none';
      if (store.localHeldItem !== 'none' && activeHeld === 'none') {
        store.setLocalHeldItem('none', 0);
      }
      if (activeHeld !== localHeldApplied) {
        localHeldApplied = activeHeld;
        setCharacterHeldItem(localRig, activeHeld);
      }

      // 2. Handle pending teleport (from Properties / Vehicles / Friends / Missions quick-travel)
      if (store.pendingTeleport) {
        const tp = store.pendingTeleport;
        store.requestTeleport(null);
        if (store.activeVehicleId) {
          multiplayer.exitVehicle();
        }
        playerState.x = tp.x;
        playerState.z = tp.z;
        playerState.y = Math.max(0, physics.getGroundHeight(tp.x, tp.z));
        playerState.vx = 0;
        playerState.vy = 0;
        playerState.vz = 0;
        multiplayer.sendMove(playerState.x, playerState.y, playerState.z, playerState.rotY, 'idle', 0, true);
      }

      // 3. Handle pending emote trigger
      if (store.pendingEmote) {
        playerState.activeEmote = store.pendingEmote;
        playerState.emoteUntil = now + 3400;
        multiplayer.sendEmote(store.pendingEmote);
        store.triggerEmote(null);
      }

      // 4. Step Rapier Physics
      physics.step();

      // 5. Gather Movement Input (Keyboard + Mobile Touch)
      const mobile = mobileInputRef.current;
      let moveForward = mobile.moveY;
      let moveRight = mobile.moveX;
      if (!isTypingInInput() && store.activePanel !== 'pause') {
        if (keys.has('KeyW') || keys.has('ArrowUp')) moveForward += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveForward -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;
      }
      moveForward = Math.max(-1, Math.min(1, moveForward));
      moveRight = Math.max(-1, Math.min(1, moveRight));

      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || mobile.sprint;
      const jumping = keys.has('Space') || mobile.jump;

      // 6. Vehicle Driving vs On-Foot Third-Person Controller
      const activeVehId = store.activeVehicleId;
      const activeVeh = activeVehId ? store.vehicles[activeVehId] : null;
      let currentSpeedMps = 0;

      const pBus = store.publicBus;
      const myUid = store.firebaseUser?.uid || store.profile?.uid || '';
      const ridingPublicBus = Boolean(
        pBus &&
          !activeVeh &&
          (pBus.conductorUid === myUid || pBus.passengers.some((p) => p.uid === myUid)),
      );

      if (ridingPublicBus && pBus) {
        lastActiveVehicleId = null;
        localRig.root.visible = false;
        playerState.x = pBus.x;
        playerState.y = pBus.y + 0.6;
        playerState.z = pBus.z;
        playerState.rotY = pBus.rotY;
        playerState.anim = 'sit';
        currentSpeedMps = Math.abs(pBus.speed);
        multiplayer.sendMove(playerState.x, playerState.y, playerState.z, playerState.rotY, 'sit', currentSpeedMps);
      } else if (activeVeh) {
        if (lastActiveVehicleId !== activeVeh.id) {
          lastActiveVehicleId = activeVeh.id;
          playerState.x = activeVeh.x;
          playerState.y = activeVeh.y;
          playerState.z = activeVeh.z;
          driveState.rotY = activeVeh.rotY;
          driveState.speed = activeVeh.speed || 0;
          driveState.y = activeVeh.y;
        }

        // Driving Physics (Acceleration, Braking, Reverse, Steering, Handbrake / Flying Lift)
        const handbrake = !activeVeh.canFly && jumping;
        if (moveForward > 0.05) {
          driveState.speed = Math.min(activeVeh.maxSpeed, driveState.speed + activeVeh.accel * moveForward * dt);
        } else if (moveForward < -0.05) {
          driveState.speed = Math.max(-activeVeh.maxSpeed * 0.42, driveState.speed + activeVeh.accel * 1.3 * moveForward * dt);
        } else {
          // Natural rolling friction
          const drag = Math.exp(-2.8 * dt);
          driveState.speed *= drag;
          if (Math.abs(driveState.speed) < 0.08) driveState.speed = 0;
        }

        if (handbrake) {
          driveState.speed *= Math.exp(-8.5 * dt);
        }

        const steerDir = driveState.speed >= -0.1 ? 1 : -1;
        const speedFactor = activeVeh.canFly
          ? 1.0
          : Math.min(1, Math.abs(driveState.speed) / 3.5);
        driveState.rotY -= moveRight * activeVeh.turnSpeed * speedFactor * steerDir * dt;

        const nextX = playerState.x + Math.sin(driveState.rotY) * driveState.speed * dt;
        const nextZ = playerState.z + Math.cos(driveState.rotY) * driveState.speed * dt;

        // Vertical hover/flight for SkyCab Flying Taxi
        const groundY = physics.getGroundHeight(nextX, nextZ);
        if (activeVeh.canFly) {
          if (jumping) {
            driveState.y = Math.min(58, driveState.y + 12 * dt);
          } else if (sprinting) {
            driveState.y = Math.max(groundY, driveState.y - 12 * dt);
          } else if (driveState.y > groundY + 0.25) {
            // Subtle stable hover
            driveState.y = Math.max(groundY, driveState.y + Math.sin(elapsed * 3) * 0.01);
          } else {
            driveState.y = groundY;
          }
        } else {
          driveState.y = groundY;
        }

        const resolved = physics.resolveHorizontal(
          nextX,
          driveState.y,
          nextZ,
          activeVeh.kind === 'ksrtc_bus'
            ? 2.2
            : activeVeh.kind === 'motorcycle' || activeVeh.kind === 'bicycle'
              ? 0.95
              : 1.75,
          activeVeh.kind === 'ksrtc_bus' ? 3.2 : 2.0,
        );
        if (resolved.collided) {
          driveState.speed *= 0.25;
        }

        playerState.x = resolved.x;
        playerState.y = driveState.y;
        playerState.z = resolved.z;
        playerState.rotY = driveState.rotY;
        playerState.anim = 'drive';
        currentSpeedMps = Math.abs(driveState.speed);

        // Position vehicle rig & seated player rig smoothly
        const vRig = vehicleRigs.get(activeVeh.id);
        if (vRig) {
          vRig.root.position.set(playerState.x, playerState.y, playerState.z);
          vRig.root.rotation.y = playerState.rotY;
          for (const w of vRig.wheels) {
            w.rotation.x += driveState.speed * dt * 2.2;
          }
        }
        // Show player seated on bike/moto, hide inside closed cabin cars
        localRig.root.visible =
          activeVeh.kind === 'motorcycle' || activeVeh.kind === 'bicycle';
        if (localRig.root.visible) {
          localRig.root.position.set(playerState.x, playerState.y + 0.35, playerState.z);
          localRig.root.rotation.y = playerState.rotY;
          animateCharacterRig(localRig, 'drive', dt, elapsed);
        }

        // Gently auto-follow chase cam yaw behind vehicle when driving without dragging
        if (!camState.dragging && Math.abs(driveState.speed) > 1.0) {
          const desiredYaw = playerState.rotY + Math.PI;
          camState.yaw += shortestAngleDelta(camState.yaw, desiredYaw) * (1 - Math.exp(-2.8 * dt));
        }

        multiplayer.sendMove(
          playerState.x,
          playerState.y,
          playerState.z,
          playerState.rotY,
          'drive',
          driveState.speed,
        );
      } else {
        lastActiveVehicleId = null;
        localRig.root.visible = true;

        // Camera-relative movement direction
        const sinY = Math.sin(camState.yaw);
        const cosY = Math.cos(camState.yaw);
        let dirX = -sinY * moveForward + cosY * moveRight;
        let dirZ = -cosY * moveForward - sinY * moveRight;
        const inputLen = Math.hypot(dirX, dirZ);
        if (inputLen > 0.001) {
          dirX /= inputLen;
          dirZ /= inputLen;
          playerState.activeEmote = null;
        }

        const targetSpeed = inputLen > 0.05 ? (sprinting ? 11.2 : 6.0) : 0;
        const targetVx = dirX * targetSpeed;
        const targetVz = dirZ * targetSpeed;
        const accelLambda = inputLen > 0.05 ? 11 : 13;
        const blend = 1 - Math.exp(-accelLambda * dt);
        playerState.vx += (targetVx - playerState.vx) * blend;
        playerState.vz += (targetVz - playerState.vz) * blend;

        // Jump & Gravity
        if (jumping && playerState.onGround) {
          playerState.vy = 8.4;
          playerState.onGround = false;
          playerState.peakAirY = playerState.y;
          playerState.activeEmote = null;
          playSfx('jump');
        }
        playerState.vy -= 22.0 * dt;

        const candX = playerState.x + playerState.vx * dt;
        const candZ = playerState.z + playerState.vz * dt;
        const resolved = physics.resolveHorizontal(candX, playerState.y, candZ, 0.52, 1.85);
        playerState.x = resolved.x;
        playerState.z = resolved.z;

        const groundY = physics.getGroundHeight(playerState.x, playerState.z);
        playerState.y += playerState.vy * dt;
        if (!playerState.onGround) {
          if (playerState.y > playerState.peakAirY) playerState.peakAirY = playerState.y;
        }
        if (playerState.y <= groundY) {
          if (!playerState.onGround) {
            const drop = playerState.peakAirY - groundY;
            if (drop > 3.5) {
              const dmg = Math.min(48, Math.max(6, Math.round((drop - 3.0) * 8)));
              const nextHp = Math.max(5, store.health - dmg);
              store.setHealth(nextHp);
              store.pushToast(
                `Hard Fall! -${dmg} HP`,
                nextHp < 50 ? 'Health below 50% — Visit Green Valley Hospital!' : 'Watch your step on steep cliffs!',
                'rose',
              );
            }
          }
          playerState.y = groundY;
          playerState.vy = 0;
          playerState.onGround = true;
          playerState.peakAirY = groundY;
        }

        currentSpeedMps = Math.hypot(playerState.vx, playerState.vz);
        if (currentSpeedMps > 0.25) {
          const faceYaw = Math.atan2(playerState.vx, playerState.vz);
          playerState.rotY += shortestAngleDelta(playerState.rotY, faceYaw) * (1 - Math.exp(-13 * dt));
        }

        // Health Decay from Sprinting Exertion & Rain Exposure (makes Hospital & Tea Stalls essential!)
        const drainRate =
          (currentSpeedMps > 7.8 ? 0.85 : 0) + (store.weatherMode === 'rain' ? 0.45 : 0);
        if (drainRate > 0 && store.health > 15) {
          hpDrainAccum += drainRate * dt;
          if (hpDrainAccum >= 1) {
            const lose = Math.floor(hpDrainAccum);
            hpDrainAccum -= lose;
            store.setHealth(Math.max(15, store.health - lose));
          }
        }

        // Determine Character Animation State (with visible Drinking/Eating animations in hand!)
        if (!playerState.onGround) {
          playerState.anim = 'jump';
        } else if (currentSpeedMps > 7.5) {
          playerState.anim = 'run';
        } else if (currentSpeedMps > 0.35) {
          playerState.anim = 'walk';
        } else if (playerState.activeEmote && now < playerState.emoteUntil) {
          playerState.anim = playerState.activeEmote;
        } else if (activeHeld === 'tea' || activeHeld === 'latte' || activeHeld === 'juice') {
          playerState.anim = 'drink';
        } else if (activeHeld === 'snack') {
          playerState.anim = 'eat';
        } else {
          playerState.anim = 'idle';
        }

        // Subtle procedural footsteps
        if (playerState.onGround && currentSpeedMps > 1.2) {
          playerState.stepTimer += dt * (currentSpeedMps > 7.5 ? 2.6 : 1.7);
          if (playerState.stepTimer >= 1) {
            playerState.stepTimer = 0;
            playSfx('step');
          }
        }

        localRig.root.position.set(playerState.x, playerState.y, playerState.z);
        localRig.root.rotation.y = playerState.rotY;
        animateCharacterRig(localRig, playerState.anim, dt, elapsed);

        // Auto-kick playable 3D Football / Volleyball when running directly into the ball
        if (currentSpeedMps > 1.0 && now - lastBallAutoKickMs > 420) {
          const balls = store.sportsBalls;
          for (const bId of ['football', 'volleyball'] as const) {
            const b = balls[bId];
            if (b && Math.hypot(playerState.x - b.x, playerState.z - b.z) < 1.35) {
              lastBallAutoKickMs = now;
              multiplayer.kickSportsBall(
                bId,
                Math.sin(playerState.rotY),
                Math.cos(playerState.rotY),
                Math.min(24, Math.max(13, currentSpeedMps * 2.1)),
              );
              playSfx('jump');
              break;
            }
          }
        }

        multiplayer.sendMove(
          playerState.x,
          playerState.y,
          playerState.z,
          playerState.rotY,
          playerState.anim,
          currentSpeedMps,
        );
      }

      // 7. Update Third-Person Follow Camera with Collision Clamping
      const targetHeight = activeVeh ? (activeVeh.kind === 'ksrtc_bus' ? 2.6 : 1.85) : 1.55;
      const dist = activeVeh
        ? activeVeh.kind === 'ksrtc_bus'
          ? Math.max(12.8, camState.distance + 4.8)
          : Math.max(8.5, camState.distance + 2.2)
        : camState.distance;
      _camTarget.set(playerState.x, playerState.y + targetHeight, playerState.z);
      const horiz = Math.cos(camState.pitch) * dist;
      const vert = Math.sin(camState.pitch) * dist;
      _camDesired.set(
        _camTarget.x + Math.sin(camState.yaw) * horiz,
        _camTarget.y + vert,
        _camTarget.z + Math.cos(camState.yaw) * horiz,
      );
      const safeCam = physics.clampCameraPosition(
        _camTarget.x,
        _camTarget.y,
        _camTarget.z,
        _camDesired.x,
        _camDesired.y,
        _camDesired.z,
      );
      const camLerp = 1 - Math.exp(-14 * dt);
      camera.position.x += (safeCam.x - camera.position.x) * camLerp;
      camera.position.y += (safeCam.y - camera.position.y) * camLerp;
      camera.position.z += (safeCam.z - camera.position.z) * camLerp;
      camera.lookAt(_camTarget);

      // Keep sun shadow frustum centered near player for crisp shadows anywhere in Green Valley
      sunLight.target.position.set(playerState.x, 0, playerState.z);

      // 8. Sync Remote Vehicles, Full-Time KSRTC Public Bus & Playable 3D Sports Balls
      syncVehiclesToScene();
      const vehiclesMap = store.vehicles;
      for (const veh of Object.values(vehiclesMap)) {
        if (veh.id === activeVehId) continue;
        const vRig = vehicleRigs.get(veh.id);
        if (!vRig) continue;
        const vLerp = 1 - Math.exp(-11 * dt);
        vRig.root.position.x += (veh.x - vRig.root.position.x) * vLerp;
        vRig.root.position.y += (veh.y - vRig.root.position.y) * vLerp;
        vRig.root.position.z += (veh.z - vRig.root.position.z) * vLerp;
        vRig.root.rotation.y += shortestAngleDelta(vRig.root.rotation.y, veh.rotY) * vLerp;
        if (Math.abs(veh.speed) > 0.2) {
          for (const w of vRig.wheels) w.rotation.x += veh.speed * dt * 2.2;
        }
      }

      if (pBus) {
        if (!publicBusRig.group.visible) {
          publicBusRig.group.visible = true;
          publicBusRig.group.position.set(pBus.x, pBus.y, pBus.z);
          publicBusRig.group.rotation.y = pBus.rotY;
        } else {
          const bLerp = 1 - Math.exp(-10 * dt);
          publicBusRig.group.position.x += (pBus.x - publicBusRig.group.position.x) * bLerp;
          publicBusRig.group.position.y += (pBus.y - publicBusRig.group.position.y) * bLerp;
          publicBusRig.group.position.z += (pBus.z - publicBusRig.group.position.z) * bLerp;
          publicBusRig.group.rotation.y +=
            shortestAngleDelta(publicBusRig.group.rotation.y, pBus.rotY) * bLerp;
        }
        if (Math.abs(pBus.speed) > 0.2) {
          for (const w of publicBusRig.wheels) w.rotation.x += pBus.speed * dt * 1.9;
        }
      }

      const sb = store.sportsBalls;
      const syncBall = (rig: { mesh: THREE.Mesh }, state?: { x: number; y: number; z: number; vx: number; vz: number }) => {
        if (!state) return;
        const bLerp = 1 - Math.exp(-14 * dt);
        rig.mesh.position.x += (state.x - rig.mesh.position.x) * bLerp;
        rig.mesh.position.y += (Math.max(0.45, state.y) - rig.mesh.position.y) * bLerp;
        rig.mesh.position.z += (state.z - rig.mesh.position.z) * bLerp;
        rig.mesh.rotation.x += state.vz * dt * 1.8;
        rig.mesh.rotation.z -= state.vx * dt * 1.8;
      };
      syncBall(footballRig, sb.football);
      syncBall(volleyballRig, sb.volleyball);

      // 9. Sync & Smoothly Interpolate All Connected Remote Players
      const remotes = store.remotePlayers;
      const activeRemoteUids = new Set(Object.keys(remotes));
      for (const [uid, vis] of remoteVisuals.entries()) {
        if (!activeRemoteUids.has(uid)) {
          scene.remove(vis.rig.root);
          vis.rig.dispose();
          remoteVisuals.delete(uid);
        }
      }

      for (const rp of Object.values(remotes)) {
        const appKey = `${JSON.stringify(rp.appearance)}|m${rp.muscleLevel || 0}`;
        let vis = remoteVisuals.get(rp.uid);
        const vp = store.voicePeers[rp.uid];
        const voiceTag = vp?.speaking
          ? 'TALKING'
          : rp.voiceActive || vp
            ? (vp?.muted || rp.voiceMuted ? 'MIC MUTED' : 'VOICE')
            : '';
        const subline = `Lv.${rp.level}${rp.instagramId ? ` · @${rp.instagramId}` : ''}${rp.isAdmin ? ' · ADMIN' : ''}${voiceTag ? ` · ${voiceTag}` : ''}`;
        const accentColor = vp?.speaking ? '#10b981' : rp.isAdmin ? '#f59e0b' : '#38bdf8';

        if (!vis || vis.appearanceKey !== appKey) {
          if (vis) {
            scene.remove(vis.rig.root);
            vis.rig.dispose();
          }
          const rig = buildCharacterRig(rp.appearance, rp.muscleLevel || 0);
          const plate = createNameplateSprite(rp.displayName, subline, rp.chatBubble, accentColor);
          plate.position.y = 2.52;
          rig.root.add(plate);
          rig.root.position.set(rp.x, rp.y, rp.z);
          rig.root.rotation.y = rp.rotY;
          scene.add(rig.root);
          vis = {
            uid: rp.uid,
            rig,
            plate,
            appearanceKey: appKey,
            lastHeldItem: 'none',
            lastDisplayName: rp.displayName,
            lastInstagramId: rp.instagramId || '',
            lastChatBubble: rp.chatBubble || '',
            lastVoiceTag: voiceTag,
            pos: new THREE.Vector3(rp.x, rp.y, rp.z),
            rotY: rp.rotY,
          };
          remoteVisuals.set(rp.uid, vis);
        }

        const rHeld: HeldItemType =
          rp.heldItem && rp.heldItem !== 'none' && (!rp.heldItemUntil || Date.now() <= rp.heldItemUntil)
            ? rp.heldItem
            : 'none';
        if (vis.lastHeldItem !== rHeld) {
          vis.lastHeldItem = rHeld;
          setCharacterHeldItem(vis.rig, rHeld);
        }

        // Update nameplate if display name, Instagram handle, voice state, or live chat bubble changed
        const nextBubble = rp.chatBubble || '';
        const nextInsta = rp.instagramId || '';
        if (
          vis.lastDisplayName !== rp.displayName ||
          vis.lastInstagramId !== nextInsta ||
          vis.lastChatBubble !== nextBubble ||
          vis.lastVoiceTag !== voiceTag
        ) {
          vis.lastDisplayName = rp.displayName;
          vis.lastInstagramId = nextInsta;
          vis.lastChatBubble = nextBubble;
          vis.lastVoiceTag = voiceTag;
          const canvas = vis.plate.userData.canvas as HTMLCanvasElement | undefined;
          if (canvas) {
            updateNameplateCanvas(
              vis.plate,
              canvas,
              rp.displayName,
              subline,
              nextBubble || undefined,
              accentColor,
            );
          }
        }

        const rLerp = 1 - Math.exp(-12 * dt);
        vis.pos.x += (rp.x - vis.pos.x) * rLerp;
        vis.pos.y += (rp.y - vis.pos.y) * rLerp;
        vis.pos.z += (rp.z - vis.pos.z) * rLerp;
        vis.rotY += shortestAngleDelta(vis.rotY, rp.rotY) * rLerp;

        const rVeh = rp.vehicleId ? vehiclesMap[rp.vehicleId] : null;
        const hideInsideCar = rVeh && rVeh.kind !== 'motorcycle' && rVeh.kind !== 'bicycle';
        vis.rig.root.visible = !hideInsideCar;
        vis.rig.root.position.set(vis.pos.x, vis.pos.y + (rVeh ? 0.35 : 0), vis.pos.z);
        vis.rig.root.rotation.y = vis.rotY;
        animateCharacterRig(vis.rig, rp.anim, dt, elapsed);
      }

      // 9b. Sync Dynamic Custom 3D Homes (Player-built & Admin-built)
      const customHomesMap = store.customHomes;
      for (const [homeId, vis] of customHomeVisuals.entries()) {
        if (!customHomesMap[homeId]) {
          scene.remove(vis.group);
          vis.dispose();
          physics.removeStaticBox(`custom-${homeId}`);
          customHomeVisuals.delete(homeId);
        }
      }
      for (const home of Object.values(customHomesMap)) {
        if (!customHomeVisuals.has(home.homeId)) {
          const built = buildCustomHomeMesh(home, world.windowGlowMat, world.poolWaterMat);
          scene.add(built.group);
          physics.addStaticBox(
            `custom-${home.homeId}`,
            home.x,
            home.y + built.size.y * 0.5,
            home.z,
            built.size.x,
            built.size.y,
            built.size.z,
          );
          customHomeVisuals.set(home.homeId, { group: built.group, dispose: built.dispose });
        }
      }

      // 9c. Sync Dynamic Custom 3D Player Shops (rebuilds cleanly if Admin expands/relocates!)
      const customShopsMap = store.customShops;
      for (const [shopId, vis] of customShopVisuals.entries()) {
        if (!customShopsMap[shopId]) {
          scene.remove(vis.group);
          vis.dispose();
          physics.removeStaticBox(`cshop-${shopId}`);
          customShopVisuals.delete(shopId);
        }
      }
      for (const shop of Object.values(customShopsMap)) {
        const shopKey = `${shop.x}|${shop.z}|${shop.sizeTier || 'small'}|${shop.name}|${shop.hasSeating ? 1 : 0}|${shop.hasAc ? 1 : 0}`;
        const existing = customShopVisuals.get(shop.shopId);
        if (!existing || existing.shopKey !== shopKey) {
          if (existing) {
            scene.remove(existing.group);
            existing.dispose();
            physics.removeStaticBox(`cshop-${shop.shopId}`);
          }
          const built = buildCustomShopMesh(shop);
          scene.add(built.group);
          physics.addStaticBox(
            `cshop-${shop.shopId}`,
            shop.x,
            shop.y + built.size.y * 0.5,
            shop.z,
            built.size.x,
            built.size.y,
            built.size.z,
          );
          customShopVisuals.set(shop.shopId, {
            group: built.group,
            shopKey,
            dispose: built.dispose,
          });
        }
      }

      // 10. Ambient World Animations (Fountain, Water, Clouds, Sailboat, Campfire, NPCs, Beacon)
      world.waterTexture.offset.x = (elapsed * 0.025) % 1;
      world.waterTexture.offset.y = (elapsed * 0.015) % 1;
      for (let i = 0; i < world.fountainJets.length; i++) {
        const j = world.fountainJets[i];
        const phase = (elapsed * 2.2 + i * 0.55) % 1;
        j.position.y = 3.2 + Math.sin(phase * Math.PI) * 1.45;
      }
      world.cloudsGroup.children.forEach((cg, idx) => {
        cg.position.x += dt * (1.2 + (idx % 3) * 0.45);
        if (cg.position.x > 360) cg.position.x = -360;
      });
      world.sailboat.position.y = -0.25 + Math.sin(elapsed * 1.4) * 0.1;
      world.sailboat.rotation.z = Math.sin(elapsed * 1.1) * 0.04;
      world.campfireGlow.scale.y = 0.88 + Math.sin(elapsed * 12) * 0.18;

      for (const n of world.npcRigs) {
        animateCharacterRig(n.rig, 'idle', dt, elapsed + n.baseRotY);
      }

      // Active Objective Beacon (Priority: Active Work Shift > Walk-To Waypoint > Active Mission)
      const activeWorkShift = store.activeWorkShift;
      const waypointTarget = store.waypointTarget;
      const activeMission = store.activeMissionId
        ? MISSIONS.find((m) => m.id === store.activeMissionId)
        : null;

      if (waypointTarget && Math.hypot(playerState.x - waypointTarget.x, playerState.z - waypointTarget.z) < 7.5) {
        store.setWaypointTarget(null);
      }

      const beaconTarget = activeWorkShift
        ? activeWorkShift.target
        : waypointTarget
          ? { x: waypointTarget.x, z: waypointTarget.z }
          : activeMission
            ? activeMission.target
            : null;

      if (beaconTarget) {
        world.missionBeacon.visible = true;
        world.missionBeacon.position.set(
          beaconTarget.x,
          physics.getGroundHeight(beaconTarget.x, beaconTarget.z),
          beaconTarget.z,
        );
        world.missionBeacon.rotation.y = elapsed * 1.2;
      } else {
        world.missionBeacon.visible = false;
      }

      // Hidden VIP Game Center Card animation & Live 3D Mingle Screen sync
      world.hiddenCardGroup.visible = !store.profile?.hasGameCenterCard;
      if (world.hiddenCardGroup.visible) {
        world.hiddenCardGroup.rotation.y = elapsed * 2.1;
        world.hiddenCardGroup.position.y = HIDDEN_CARD_POS.y + Math.sin(elapsed * 3.0) * 0.35;
      }

      mingleScreenTimer += dt;
      if (mingleScreenTimer >= 1.2) {
        mingleScreenTimer = 0;
        world.updateMingleScreen(store.mingleEvent);
      }

      // Sync Hashim's Villa & Rifad's Villa custom signboards whenever renamed by owner/admin
      for (const villa of Object.values(store.palaceVillas)) {
        const key = `${villa.boardName}|${villa.visitFee}`;
        if (appliedVillaBoards.get(villa.villaId) !== key) {
          appliedVillaBoards.set(villa.villaId, key);
          const signMesh = world.villaSigns.get(villa.villaId);
          if (signMesh) {
            const mat = signMesh.material as THREE.MeshStandardMaterial;
            if (mat.map) mat.map.dispose();
            mat.map = createSignTexture(
              villa.boardName,
              `Royal Palace · Visit ${villa.visitFee} GC · Key Required Inside`,
              villa.accentColor,
            );
            mat.needsUpdate = true;
          }
        }
      }

      // Update Property Yard Signs when ownership changes
      for (const prop of PROPERTIES) {
        const own = store.worldProperties[prop.id];
        const labelKey = own ? `${own.ownerName}|${own.interiorTheme}` : 'FOR_SALE';
        if (appliedPropertyOwners.get(prop.id) !== labelKey) {
          appliedPropertyOwners.set(prop.id, labelKey);
          const signMesh = world.propertySigns.get(prop.id);
          if (signMesh) {
            const mat = signMesh.material as THREE.MeshStandardMaterial;
            if (mat.map) mat.map.dispose();
            mat.map = createSignTexture(
              prop.name,
              own ? `Owner: ${own.ownerName}` : `For Sale · ${prop.price} GC`,
              own ? '#38bdf8' : '#10b981',
            );
            mat.needsUpdate = true;
          }
        }
      }

      // 11. Day/Night Cycle & Weather Atmosphere
      const tod = store.timeOfDayMode;
      if (tod === 'cycle') {
        dayTime = (dayTime + dt * 0.0045) % 1;
      } else if (tod === 'morning') {
        dayTime = 0.25;
      } else if (tod === 'noon') {
        dayTime = 0.48;
      } else if (tod === 'golden') {
        dayTime = 0.72;
      } else {
        dayTime = 0.94;
      }

      const sunAngle = dayTime * Math.PI * 2 - Math.PI * 0.5;
      const sunElev = Math.sin(sunAngle); // -1 night to +1 noon
      sunLight.position.set(
        playerState.x + Math.cos(sunAngle) * 110,
        Math.max(18, sunElev * 125 + 25),
        playerState.z + 55,
      );

      const isNight = sunElev < -0.08;
      if (sunElev > 0.28) {
        _skyCurrent.copy(_skyDay);
        _sunCurrent.copy(_sunDay);
        sunLight.intensity = 1.85;
        hemiLight.intensity = 0.85;
      } else if (sunElev > -0.12) {
        const t = (sunElev + 0.12) / 0.4;
        _skyCurrent.copy(_skyNight).lerp(_skyGolden, Math.min(1, t * 1.4));
        if (t > 0.55) _skyCurrent.lerp(_skyDay, (t - 0.55) / 0.45);
        _sunCurrent.copy(_sunNight).lerp(_sunGolden, Math.min(1, t * 1.4));
        sunLight.intensity = 0.65 + t * 1.2;
        hemiLight.intensity = 0.42 + t * 0.43;
      } else {
        _skyCurrent.copy(_skyNight);
        _sunCurrent.copy(_sunNight);
        sunLight.intensity = 0.52;
        hemiLight.intensity = 0.36;
      }

      // Weather adjustments
      const weather = store.weatherMode;
      if (weather === 'rain') {
        _skyCurrent.lerp(new THREE.Color('#475569'), 0.45);
        fog.density = 0.0062;
        world.rainPoints.visible = true;
        world.rainPoints.position.set(playerState.x, 0, playerState.z);
        const rPos = world.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rPos.count; i++) {
          let ry = rPos.getY(i) - dt * 34;
          if (ry < 0) ry = 40;
          rPos.setY(i, ry);
        }
        rPos.needsUpdate = true;
      } else if (weather === 'mist') {
        _skyCurrent.lerp(new THREE.Color('#cbd5e1'), 0.35);
        fog.density = 0.0068;
        world.rainPoints.visible = false;
      } else {
        fog.density = 0.0018;
        world.rainPoints.visible = false;
      }

      scene.background = _skyCurrent;
      fog.color.copy(_skyCurrent);
      sunLight.color.copy(_sunCurrent);
      world.lampBulbMat.emissiveIntensity = isNight ? 2.2 : 0.2;
      world.windowGlowMat.emissiveIntensity = isNight ? 1.15 : 0.12;

      // 12. Throttled HUD Telemetry & Proximity Interaction Detection (~10 Hz)
      uiSyncTimer += dt;
      if (uiSyncTimer >= 0.1) {
        uiSyncTimer = 0;
        const district = getDistrictAt(playerState.x, playerState.z);
        store.setTelemetry(
          Math.round(currentSpeedMps * 3.6),
          Math.max(0, Math.round(playerState.y)),
          district.name,
          { x: playerState.x, y: playerState.y, z: playerState.z, rotY: playerState.rotY },
        );

        // Compute nearest interactive object if on foot
        if (activeVehId) {
          store.setNearbyPrompt(null);
        } else {
          let bestPrompt: InteractablePrompt | null = null;
          let bestDist = Infinity;

          // Active Work Shift objective check
          if (activeWorkShift) {
            const d = Math.hypot(
              playerState.x - activeWorkShift.target.x,
              playerState.z - activeWorkShift.target.z,
            );
            if (d < 12 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-work-${activeWorkShift.jobId}`,
                type: 'work',
                label: `Finish Work: ${activeWorkShift.title}`,
                sublabel: `+${activeWorkShift.payout} Green Coins · +${activeWorkShift.xp} XP`,
                targetId: activeWorkShift.jobId,
                position: activeWorkShift.target,
              };
            }
          }

          // Active mission objective check
          if (activeMission) {
            const d = Math.hypot(
              playerState.x - activeMission.target.x,
              playerState.z - activeMission.target.z,
            );
            if (d < 11 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-mis-${activeMission.id}`,
                type: 'mission',
                label: `Complete: ${activeMission.title}`,
                sublabel: `+${activeMission.rewardCoins} Green Coins`,
                targetId: activeMission.id,
                position: activeMission.target,
              };
            }
          }

          // Nearby unoccupied walk-up vehicles
          for (const v of Object.values(vehiclesMap)) {
            if (v.driverUid !== null) continue;
            const d = Math.hypot(playerState.x - v.x, playerState.z - v.z);
            if (d < 5.8 && d < bestDist) {
              bestDist = d;
              const isFree = v.rentPrice <= 0 && v.buyPrice <= 0;
              const isOwned = Boolean(store.profile?.ownedVehicles.includes(v.id));
              bestPrompt = {
                id: `prompt-veh-${v.id}`,
                type: 'vehicle',
                label:
                  store.isAdmin || isFree || isOwned ? `Drive ${v.name}` : `Rent or Buy ${v.name}`,
                sublabel: store.isAdmin
                  ? 'Admin Free Access'
                  : isFree
                    ? 'Free Walk-Up Vehicle'
                    : isOwned
                      ? 'Owned Vehicle · Free to Drive'
                      : `Rent ${v.rentPrice} GC · Buy ${v.buyPrice} GC`,
                targetId: v.id,
                position: { x: v.x, y: v.y, z: v.z },
              };
            }
          }

          // Nearby Custom Homes
          for (const ch of Object.values(customHomesMap)) {
            const d = Math.hypot(playerState.x - ch.x, playerState.z - (ch.z + 7));
            if (d < 8.5 && d < bestDist) {
              bestDist = d;
              const insta = ch.ownerInstagram ? ` (@${ch.ownerInstagram})` : '';
              bestPrompt = {
                id: `prompt-ch-${ch.homeId}`,
                type: 'custom_home',
                label: ch.name,
                sublabel: `Owner: ${ch.ownerName}${insta}`,
                targetId: ch.homeId,
                position: { x: ch.x, y: ch.y, z: ch.z },
              };
            }
          }

          // Nearby NPCs
          for (const npc of NPCS) {
            const d = Math.hypot(playerState.x - npc.position.x, playerState.z - npc.position.z);
            if (d < 5.2 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-npc-${npc.id}`,
                type: 'npc',
                label: `Talk to ${npc.name}`,
                sublabel: npc.role,
                targetId: npc.id,
                position: npc.position,
              };
            }
          }

          // Nearby ATMs
          for (const atm of ATM_LOCATIONS) {
            const d = Math.hypot(playerState.x - atm.position.x, playerState.z - atm.position.z);
            if (d < 4.5 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-atm-${atm.id}`,
                type: 'atm',
                label: `Use ${atm.name}`,
                sublabel: 'View Green Coins & History',
                targetId: atm.id,
                position: atm.position,
              };
            }
          }

          // Nearby Properties
          for (const prop of PROPERTIES) {
            const d = Math.hypot(
              playerState.x - prop.doorPosition.x,
              playerState.z - prop.doorPosition.z,
            );
            if (d < 6.5 && d < bestDist) {
              bestDist = d;
              const own = store.worldProperties[prop.id];
              const isMine = own && own.ownerUid === store.firebaseUser?.uid;
              bestPrompt = {
                id: `prompt-prop-${prop.id}`,
                type: 'property',
                label: isMine
                  ? `Customize ${prop.name}`
                  : own
                    ? `${prop.name} (${own.ownerName})`
                    : store.isAdmin
                      ? `Claim ${prop.name} (Free)`
                      : `Buy ${prop.name}`,
                sublabel: isMine
                  ? 'Interior & Garden Studio'
                  : own
                    ? store.isAdmin
                      ? 'Admin Can Customize'
                      : 'Owned Residence'
                    : store.isAdmin
                      ? 'Admin Free Access'
                      : `${prop.price} Green Coins`,
                targetId: prop.id,
                position: prop.doorPosition,
              };
            }
          }

          // Nearby Businesses
          for (const biz of BUSINESSES) {
            const d = Math.hypot(playerState.x - biz.position.x, playerState.z - biz.position.z);
            if (d < 9.5 && d < bestDist) {
              bestDist = d;
              const isOwned = store.profile?.ownedBusinesses.includes(biz.id);
              bestPrompt = {
                id: `prompt-biz-${biz.id}`,
                type: 'business',
                label: isOwned
                  ? `Collect Revenue: ${biz.name}`
                  : store.isAdmin
                    ? `Acquire ${biz.name} (Free)`
                    : `Inspect ${biz.name}`,
                sublabel: isOwned
                  ? `+${biz.payout} Green Coins`
                  : store.isAdmin
                    ? 'Admin Free Access'
                    : `Acquire for ${biz.price} GC`,
                targetId: biz.id,
                position: biz.position,
              };
            }
          }

          // Nearby Active Enterable Buildings (Hospital, Mall, Bank, School, College, Library, Cinema, Gym, KSRTC, Airport, Wedding Hall, Honeymoon Resort)
          for (const bldg of ACTIVE_BUILDINGS) {
            const d = Math.hypot(
              playerState.x - bldg.doorPosition.x,
              playerState.z - bldg.doorPosition.z,
            );
            if (d < 7.2 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-bldg-${bldg.id}`,
                type: 'building',
                label: `Enter ${bldg.name}`,
                sublabel: bldg.subtitle,
                targetId: bldg.id,
                position: bldg.doorPosition,
              };
            }
          }

          // Nearby Player-Opened Custom Shops (Tea Stalls / Chaya Kada, Juice Bars, Bakeries)
          for (const cshop of Object.values(customShopsMap)) {
            const d = Math.hypot(playerState.x - cshop.x, playerState.z - (cshop.z + 2.2));
            if (d < 6.2 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-cshop-${cshop.shopId}`,
                type: 'custom_shop',
                label: `Order from ${cshop.name}`,
                sublabel: `Owner: ${cshop.ownerName}${cshop.ownerInstagram ? ` (@${cshop.ownerInstagram})` : ''}`,
                targetId: cshop.shopId,
                position: { x: cshop.x, y: cshop.y, z: cshop.z },
              };
            }
          }

          // Nearby Full-Time KSRTC Public Bus
          if (pBus) {
            const dBus = Math.hypot(playerState.x - pBus.x, playerState.z - pBus.z);
            if (dBus < 8.5 && dBus < bestDist) {
              bestDist = dBus;
              bestPrompt = {
                id: 'prompt-public-bus',
                type: 'public_bus',
                label: 'KSRTC 24/7 Public Bus & Conductor',
                sublabel: `${pBus.currentStopName} · Fare ${pBus.fare} GC`,
                targetId: pBus.id,
                position: { x: pBus.x, y: pBus.y, z: pBus.z },
              };
            }
          }

          // Nearby Palace Villas (Hashim's Villa & Rifad's Villa)
          const villasToCheck = Object.values(store.palaceVillas).length
            ? Object.values(store.palaceVillas)
            : PALACE_VILLAS;
          for (const v of villasToCheck) {
            const dGate = Math.hypot(playerState.x - v.gatePos.x, playerState.z - v.gatePos.z);
            const dDoor = Math.hypot(playerState.x - v.doorPos.x, playerState.z - v.doorPos.z);
            const d = Math.min(dGate, dDoor);
            if (d < 8.5 && d < bestDist) {
              bestDist = d;
              bestPrompt = {
                id: `prompt-villa-${v.villaId}`,
                type: 'villa',
                label: `Inspect ${v.boardName}`,
                sublabel: `Visit Grounds (${v.visitFee} GC) or Unlock House with Key`,
                targetId: v.villaId,
                position: dGate < dDoor ? v.gatePos : v.doorPos,
              };
            }
          }

          // Hidden VIP Game Center Entrance Card (Danger Peak Cliff)
          if (!store.profile?.hasGameCenterCard) {
            const dCard = Math.hypot(
              playerState.x - HIDDEN_CARD_POS.x,
              playerState.z - HIDDEN_CARD_POS.z,
            );
            if (dCard < 5.0 && dCard < bestDist) {
              bestDist = dCard;
              bestPrompt = {
                id: 'prompt-hidden-card',
                type: 'hidden_card',
                label: 'Collect Hidden VIP Entrance Card!',
                sublabel: 'Unlocks Typixel Grand Game Center (54 Games)',
                targetId: 'hidden_card',
                position: HIDDEN_CARD_POS,
              };
            }
          }

          // Playable 3D Sports Balls (Football & Volleyball)
          for (const bId of ['football', 'volleyball'] as const) {
            const b = sb[bId];
            if (!b) continue;
            const dBall = Math.hypot(playerState.x - b.x, playerState.z - b.z);
            if (dBall < 3.0 && dBall < bestDist) {
              bestDist = dBall;
              bestPrompt = {
                id: `prompt-ball-${bId}`,
                type: 'sports_ball',
                label: bId === 'football' ? 'Kick Football (E / K)' : 'Spike Volleyball (E / K)',
                sublabel: `Score ${b.scoreA} - ${b.scoreB}`,
                targetId: bId,
                position: { x: b.x, y: b.y, z: b.z },
              };
            }
          }

          // Mall Shop interaction fallback
          const mallDist = Math.hypot(playerState.x - 58, playerState.z + 2);
          if (mallDist < 6.5 && mallDist < bestDist) {
            bestPrompt = {
              id: 'prompt-mall-shop',
              type: 'shop',
              label: 'Enter Grand Valley Mall Shop',
              sublabel: 'Buy items & gear with Green Coins',
              targetId: 'mall',
              position: { x: 58, y: 0, z: -2 },
            };
          }

          store.setNearbyPrompt(bestPrompt);
        }
      }

      // 13. Periodic Firestore position checkpoint (every 20s if moved > 8m)
      firestoreSaveTimer += dt;
      if (firestoreSaveTimer >= 20) {
        firestoreSaveTimer = 0;
        const moved = Math.hypot(playerState.x - lastSavedX, playerState.z - lastSavedZ);
        if (moved > 8 && store.profile) {
          lastSavedX = playerState.x;
          lastSavedZ = playerState.z;
          const updated = {
            ...store.profile,
            lastPosition: { x: playerState.x, y: playerState.y, z: playerState.z },
          };
          store.patchProfile({ lastPosition: updated.lastPosition });
          void syncPlayerProgressToFirestore(updated).catch(() => {});
        }
      }

      // 14. Render Frame
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        scheduleSoftwareAfterDraw(renderer, tick, (id) => {
          timerId = id;
        });
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      window.clearTimeout(timerId);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      onInteractTriggerRef.current = null;

      localRig.dispose();
      publicBusRig.dispose();
      footballRig.dispose();
      volleyballRig.dispose();
      for (const vis of remoteVisuals.values()) vis.rig.dispose();
      for (const vRig of vehicleRigs.values()) vRig.dispose();
      for (const ch of customHomeVisuals.values()) ch.dispose();
      for (const cs of customShopVisuals.values()) cs.dispose();
      world.dispose();
      physics.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, [mobileInputRef, onInteractTriggerRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden select-none touch-none"
    />
  );
}

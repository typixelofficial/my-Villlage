import * as THREE from 'three';
import type { VehicleState } from '../shared/types.ts';
import { createContactShadowTexture } from './textures.ts';

let vehicleShadowTex: THREE.CanvasTexture | null = null;

export interface VehicleRig {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  thrusters: THREE.Mesh[];
  dispose: () => void;
}

export function buildVehicleRig(vehicle: VehicleState): VehicleRig {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const thrusters: THREE.Mesh[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: vehicle.color,
    roughness: 0.24,
    metalness: 0.48,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.72,
    metalness: 0.25,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#1e3a5f',
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.78,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#171717',
    roughness: 0.9,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.2,
    metalness: 0.88,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#fef9c3',
    emissive: '#fef08a',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 1.2,
    roughness: 0.25,
  });

  if (!vehicleShadowTex) {
    vehicleShadowTex = createContactShadowTexture();
  }
  const shadowSize = vehicle.kind === 'bicycle' || vehicle.kind === 'motorcycle' ? 2.2 : 4.6;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(shadowSize * 0.75, shadowSize),
    new THREE.MeshBasicMaterial({
      map: vehicleShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const addWheel = (x: number, y: number, z: number, radius: number, width: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, width, 16),
      tireMat,
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 12),
      rimMat,
    );
    rim.rotation.z = Math.PI / 2;
    wg.add(tire, rim);
    root.add(wg);
    wheels.push(wg);
  };

  if (vehicle.kind === 'motorcycle' || vehicle.kind === 'bicycle') {
    const isBike = vehicle.kind === 'bicycle';
    const r = isBike ? 0.36 : 0.38;
    const w = isBike ? 0.08 : 0.22;
    addWheel(0, r, 0.78, r, w);
    addWheel(0, r, -0.78, r, w);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(isBike ? 0.1 : 0.34, isBike ? 0.14 : 0.42, 1.35),
      bodyMat,
    );
    frame.position.set(0, 0.62, 0);
    frame.castShadow = true;
    root.add(frame);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.52), trimMat);
    seat.position.set(0, 0.88, -0.2);
    root.add(seat);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8), rimMat);
    fork.position.set(0, 0.72, 0.65);
    fork.rotation.x = -0.3;
    root.add(fork);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.68, 8), trimMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.04, 0.52);
    root.add(bar);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), headlightMat);
    lamp.position.set(0, 0.86, 0.75);
    root.add(lamp);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.06), taillightMat);
    tail.position.set(0, 0.82, -0.82);
    root.add(tail);
  } else if (vehicle.kind === 'flying_taxi') {
    // Aero SkyCab Hover Taxi
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.3), bodyMat);
    hull.position.set(0, 0.85, 0);
    hull.castShadow = true;
    root.add(hull);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 2.35), glassMat);
    canopy.position.set(0, 1.5, -0.1);
    canopy.castShadow = true;
    root.add(canopy);

    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.3),
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        emissive: '#facc15',
        emissiveIntensity: 0.9,
      }),
    );
    taxiSign.position.set(0, 1.95, 0.15);
    root.add(taxiSign);

    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 1.6), trimMat);
    wingL.position.set(-1.45, 0.75, -0.1);
    const wingR = wingL.clone();
    wingR.position.x = 1.45;
    root.add(wingL, wingR);

    const thrusterMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0ea5e9',
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const podOffsets: [number, number][] = [
      [-1.55, 0.95],
      [1.55, 0.95],
      [-1.55, -1.1],
      [1.55, -1.1],
    ];
    for (const [px, pz] of podOffsets) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.34, 14), trimMat);
      pod.position.set(px, 0.58, pz);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), thrusterMat);
      glow.position.set(px, 0.38, pz);
      root.add(pod, glow);
      thrusters.push(glow);
    }

    // Skids
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 3.2), rimMat);
    skidL.position.set(-0.95, 0.08, 0);
    const skidR = skidL.clone();
    skidR.position.x = 0.95;
    root.add(skidL, skidR);

    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.1), headlightMat);
    hlL.position.set(-0.68, 0.85, 2.16);
    const hlR = hlL.clone();
    hlR.position.x = 0.68;
    root.add(hlL, hlR);
  } else {
    // 4-Wheeled Vehicles: Electric, Sports, SUV
    const isSports = vehicle.kind === 'sports';
    const isSuv = vehicle.kind === 'suv';

    const bodyW = isSuv ? 2.1 : 1.92;
    const bodyH = isSports ? 0.56 : isSuv ? 0.82 : 0.68;
    const bodyL = isSports ? 4.35 : isSuv ? 4.4 : 3.95;
    const wheelR = isSuv ? 0.44 : 0.38;

    addWheel(-bodyW * 0.5, wheelR, bodyL * 0.32, wheelR, 0.28);
    addWheel(bodyW * 0.5, wheelR, bodyL * 0.32, wheelR, 0.28);
    addWheel(-bodyW * 0.5, wheelR, -bodyL * 0.32, wheelR, 0.28);
    addWheel(bodyW * 0.5, wheelR, -bodyL * 0.32, wheelR, 0.28);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL), bodyMat);
    chassis.position.set(0, wheelR + bodyH * 0.5 + 0.05, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    root.add(chassis);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.22, 0.2), trimMat);
    bumperF.position.set(0, wheelR + 0.1, bodyL * 0.5 + 0.04);
    const bumperB = bumperF.clone();
    bumperB.position.z = -bodyL * 0.5 - 0.04;
    root.add(bumperF, bumperB);

    // Cabin & Greenhouse
    const cabinH = isSports ? 0.5 : isSuv ? 0.72 : 0.62;
    const cabinL = isSports ? 1.85 : isSuv ? 2.65 : 2.15;
    const cabinZ = isSports ? -0.2 : -0.15;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW * 0.86, cabinH, cabinL),
      glassMat,
    );
    cabin.position.set(0, wheelR + bodyH + cabinH * 0.5, cabinZ);
    cabin.castShadow = true;
    root.add(cabin);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW * 0.84, 0.09, cabinL * 0.92),
      bodyMat,
    );
    roof.position.set(0, wheelR + bodyH + cabinH + 0.03, cabinZ);
    root.add(roof);

    // Sports rear spoiler or SUV roof rails
    if (isSports) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.92, 0.08, 0.32), trimMat);
      wing.position.set(0, wheelR + bodyH + 0.32, -bodyL * 0.44);
      root.add(wing);
    } else if (isSuv) {
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, cabinL * 0.85), rimMat);
      railL.position.set(-bodyW * 0.36, wheelR + bodyH + cabinH + 0.1, cabinZ);
      const railR = railL.clone();
      railR.position.x = bodyW * 0.36;
      root.add(railL, railR);
    }

    // Headlights & Taillights
    const hlY = wheelR + bodyH * 0.55;
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), headlightMat);
    hlL.position.set(-bodyW * 0.33, hlY, bodyL * 0.5 + 0.01);
    const hlR = hlL.clone();
    hlR.position.x = bodyW * 0.33;

    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.08), taillightMat);
    tlL.position.set(-bodyW * 0.32, hlY, -bodyL * 0.5 - 0.01);
    const tlR = tlL.clone();
    tlR.position.x = bodyW * 0.32;

    root.add(hlL, hlR, tlL, tlR);
  }

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (mat !== shadow.material) mat.dispose();
        });
      }
    });
  };

  return { root, wheels, thrusters, dispose };
}

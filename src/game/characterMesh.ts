import * as THREE from 'three';
import type { AnimationState, CharacterAppearance } from '../shared/types.ts';
import { createContactShadowTexture } from './textures.ts';

let sharedShadowTex: THREE.CanvasTexture | null = null;

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  dispose: () => void;
}

export function buildCharacterRig(appearance: CharacterAppearance): CharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isFemale = appearance.gender === 'female';
  const shoulderWidth = isFemale ? 0.44 : 0.54;
  const torsoWidth = isFemale ? 0.36 : 0.44;
  const hipWidth = isFemale ? 0.16 : 0.14;

  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.72,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.62,
    metalness: 0.05,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: appearance.shirtStyle === 'jacket' ? 0.45 : 0.82,
    metalness: appearance.shirtStyle === 'jacket' ? 0.12 : 0.02,
  });
  const accentShirtMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(appearance.shirtColor).multiplyScalar(0.72),
    roughness: 0.65,
    metalness: 0.08,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: appearance.pantsColor,
    roughness: 0.86,
    metalness: 0.02,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: appearance.shoeColor,
    roughness: 0.42,
    metalness: 0.08,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.9,
    metalness: 0.0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.35,
    metalness: 0.25,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.22,
    metalness: 0.85,
  });

  // Ground contact shadow disc (sits cleanly at y = 0.02)
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: sharedShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // Pelvis / Belt
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(torsoWidth * 0.96, 0.18, 0.24),
    pantsMat,
  );
  pelvis.position.y = 0.84;
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(torsoWidth * 1.0, 0.055, 0.255),
    darkMat,
  );
  belt.position.y = 0.92;
  bodyGroup.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), metalMat);
  buckle.position.set(0, 0.92, 0.13);
  bodyGroup.add(buckle);

  // Torso (Primary silhouette)
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(torsoWidth, 0.56, 0.25),
    shirtMat,
  );
  torso.position.y = 1.22;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  // Shirt style secondary accents
  if (appearance.shirtStyle === 'jacket') {
    const innerTee = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.34, 0.54, 0.265),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.85 }),
    );
    innerTee.position.y = 1.22;
    bodyGroup.add(innerTee);

    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.78, 0.08, 0.27),
      accentShirtMat,
    );
    collar.position.set(0, 1.51, -0.01);
    bodyGroup.add(collar);
  } else if (appearance.shirtStyle === 'hoodie') {
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.18),
      accentShirtMat,
    );
    hood.position.set(0, 1.5, -0.11);
    bodyGroup.add(hood);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.72, 0.16, 0.04),
      accentShirtMat,
    );
    pocket.position.set(0, 1.08, 0.135);
    bodyGroup.add(pocket);
  } else if (appearance.shirtStyle === 'polo') {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.07, 12),
      accentShirtMat,
    );
    collar.position.set(0, 1.52, 0);
    bodyGroup.add(collar);
  }

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 12), skinMat);
  neck.position.y = 1.54;
  bodyGroup.add(neck);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.62;
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.31), skinMat);
  head.position.y = 0.16;
  head.castShadow = true;
  headGroup.add(head);

  // Subtle stylized eyes & eyebrows
  const eyeGeo = new THREE.SphereGeometry(0.025, 10, 10);
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.075, 0.18, 0.155);
  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.075, 0.18, 0.155);
  headGroup.add(leftEye, rightEye);

  // Hair styles
  if (appearance.hairStyle === 'short') {
    const topHair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.11, 0.34), hairMat);
    topHair.position.set(0, 0.34, -0.01);
    topHair.castShadow = true;
    const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.1), hairMat);
    backHair.position.set(0, 0.22, -0.14);
    headGroup.add(topHair, backHair);
  } else if (appearance.hairStyle === 'long') {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.35), hairMat);
    crown.position.set(0, 0.34, -0.01);
    const drapeBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.44, 0.13), hairMat);
    drapeBack.position.set(0, 0.12, -0.14);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.22), hairMat);
    sideL.position.set(-0.17, 0.14, -0.02);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.22), hairMat);
    sideR.position.set(0.17, 0.14, -0.02);
    headGroup.add(crown, drapeBack, sideL, sideR);
  } else if (appearance.hairStyle === 'spiky') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.33), hairMat);
    base.position.set(0, 0.33, 0);
    headGroup.add(base);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), hairMat);
      spike.position.set(i * 0.09, 0.42, 0.02);
      spike.rotation.x = 0.22;
      headGroup.add(spike);
    }
  } else if (appearance.hairStyle === 'bob') {
    const bobCap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.26, 0.35), hairMat);
    bobCap.position.set(0, 0.26, -0.03);
    headGroup.add(bobCap);
  } else if (appearance.hairStyle === 'ponytail') {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.34), hairMat);
    crown.position.set(0, 0.34, -0.01);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.32, 10), hairMat);
    tail.position.set(0, 0.18, -0.22);
    tail.rotation.x = 0.45;
    headGroup.add(crown, tail);
  }

  // Accessories
  if (appearance.accessory === 'glasses') {
    const lensMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.1,
      metalness: 0.8,
    });
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.025), lensMat);
    frameL.position.set(-0.075, 0.18, 0.168);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.025), lensMat);
    frameR.position.set(0.075, 0.18, 0.168);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), metalMat);
    bridge.position.set(0, 0.19, 0.168);
    headGroup.add(frameL, frameR, bridge);
  } else if (appearance.accessory === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.65 });
    const dome = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), capMat);
    dome.position.set(0, 0.37, 0);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.18), capMat);
    brim.position.set(0, 0.32, 0.22);
    headGroup.add(dome, brim);
  } else if (appearance.accessory === 'headphones') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 18, Math.PI), darkMat);
    band.position.set(0, 0.22, 0);
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), metalMat);
    cupL.rotation.z = Math.PI / 2;
    cupL.position.set(-0.18, 0.18, 0);
    const cupR = cupL.clone();
    cupR.position.x = 0.18;
    headGroup.add(band, cupL, cupR);
  } else if (appearance.accessory === 'backpack') {
    const packMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.72 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.18), packMat);
    pack.position.set(0, 1.24, -0.21);
    pack.castShadow = true;
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.12, 0.19), darkMat);
    flap.position.set(0, 1.4, -0.21);
    bodyGroup.add(pack, flap);
  }

  // Arms (pivoted at shoulder)
  const buildArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * (shoulderWidth * 0.5 + 0.06), 1.44, 0);

    const sleeveLen = appearance.shirtStyle === 'tee' || appearance.shirtStyle === 'polo' ? 0.24 : 0.44;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, sleeveLen, 0.14), shirtMat);
    upper.position.y = -sleeveLen * 0.5;
    upper.castShadow = true;
    arm.add(upper);

    const forearmLen = 0.52 - sleeveLen;
    if (forearmLen > 0.04) {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.11, forearmLen, 0.12), skinMat);
      lower.position.y = -sleeveLen - forearmLen * 0.5;
      lower.castShadow = true;
      arm.add(lower);
    }

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.11), skinMat);
    hand.position.y = -0.55;
    arm.add(hand);

    bodyGroup.add(arm);
    return arm;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Legs (pivoted at hip)
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * hipWidth, 0.78, 0);

    const pant = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.64, 0.17), pantsMat);
    pant.position.y = -0.32;
    pant.castShadow = true;
    leg.add(pant);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.25), shoeMat);
    shoe.position.set(0, -0.695, 0.035);
    shoe.castShadow = true;
    leg.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.035, 0.26), soleMat);
    sole.position.set(0, -0.76, 0.035);
    leg.add(sole);

    bodyGroup.add(leg);
    return leg;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (m !== shadowPlane.material) m.dispose();
        });
      }
    });
  };

  return { root, bodyGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg, dispose };
}

export function animateCharacterRig(
  rig: CharacterRig,
  anim: AnimationState,
  dt: number,
  elapsed: number,
): void {
  const k = Math.min(1, dt * 14);
  let targetBodyY = 0;
  let targetL = 0;
  let targetR = 0;
  let targetLA = 0;
  let targetRA = 0;
  let targetLAZ = 0.06;
  let targetRAZ = -0.06;
  let targetHeadY = 0;

  if (anim === 'walk') {
    const swing = Math.sin(elapsed * 8.5);
    targetL = swing * 0.55;
    targetR = -swing * 0.55;
    targetLA = -swing * 0.45;
    targetRA = swing * 0.45;
    targetBodyY = Math.abs(Math.cos(elapsed * 8.5)) * 0.05;
  } else if (anim === 'run') {
    const swing = Math.sin(elapsed * 13.5);
    targetL = swing * 0.92;
    targetR = -swing * 0.92;
    targetLA = -swing * 0.85;
    targetRA = swing * 0.85;
    targetBodyY = Math.abs(Math.cos(elapsed * 13.5)) * 0.1;
  } else if (anim === 'jump') {
    targetL = 0.4;
    targetR = -0.3;
    targetLA = -0.9;
    targetRA = -0.9;
    targetLAZ = 0.35;
    targetRAZ = -0.35;
  } else if (anim === 'drive') {
    targetBodyY = -0.32;
    targetL = -1.25;
    targetR = -1.25;
    targetLA = -0.85;
    targetRA = -0.85;
  } else if (anim === 'wave') {
    targetRA = -2.6;
    targetRAZ = -0.35 + Math.sin(elapsed * 12) * 0.28;
    targetHeadY = Math.sin(elapsed * 4) * 0.12;
  } else if (anim === 'dance') {
    const beat = Math.sin(elapsed * 9);
    targetBodyY = Math.abs(beat) * 0.14;
    targetLA = -1.6 + beat * 0.5;
    targetRA = -1.6 - beat * 0.5;
    targetLAZ = 0.45;
    targetRAZ = -0.45;
    targetL = beat * 0.25;
    targetR = -beat * 0.25;
  } else if (anim === 'cheer') {
    targetLA = -2.85;
    targetRA = -2.85;
    targetLAZ = 0.25;
    targetRAZ = -0.25;
    targetBodyY = Math.abs(Math.sin(elapsed * 10)) * 0.18;
  } else if (anim === 'sit') {
    targetBodyY = -0.38;
    targetL = -1.38;
    targetR = -1.38;
    targetLA = -0.35;
    targetRA = -0.35;
  } else if (anim === 'clap') {
    const c = Math.abs(Math.sin(elapsed * 12));
    targetLA = -1.2;
    targetRA = -1.2;
    targetLAZ = -0.25 + c * 0.22;
    targetRAZ = 0.25 - c * 0.22;
  } else {
    // Idle gentle breathing
    targetBodyY = Math.sin(elapsed * 2.2) * 0.015;
    targetHeadY = Math.sin(elapsed * 1.1) * 0.05;
  }

  rig.bodyGroup.position.y += (targetBodyY - rig.bodyGroup.position.y) * k;
  rig.leftLeg.rotation.x += (targetL - rig.leftLeg.rotation.x) * k;
  rig.rightLeg.rotation.x += (targetR - rig.rightLeg.rotation.x) * k;
  rig.leftArm.rotation.x += (targetLA - rig.leftArm.rotation.x) * k;
  rig.rightArm.rotation.x += (targetRA - rig.rightArm.rotation.x) * k;
  rig.leftArm.rotation.z += (targetLAZ - rig.leftArm.rotation.z) * k;
  rig.rightArm.rotation.z += (targetRAZ - rig.rightArm.rotation.z) * k;
  rig.headGroup.rotation.y += (targetHeadY - rig.headGroup.rotation.y) * k;
}

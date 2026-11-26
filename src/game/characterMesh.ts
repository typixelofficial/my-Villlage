import * as THREE from 'three';
import type { AnimationState, CharacterAppearance, HeldItemType } from '../shared/types.ts';
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
  heldItemGroup: THREE.Group;
  currentHeldItem: HeldItemType;
  dispose: () => void;
}

export function buildCharacterRig(
  appearance: CharacterAppearance,
  muscleLevel = 0,
): CharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isFemale = appearance.gender === 'female';
  const isDress = appearance.shirtStyle === 'dress';
  const isKurti = appearance.shirtStyle === 'kurti';
  const isLehenga = appearance.shirtStyle === 'lehenga';
  const isMundu = appearance.shirtStyle === 'mundu';
  const hasSkirt = isDress || isLehenga;
  const muscleBoost = Math.max(0, Math.min(10, muscleLevel)) * 0.018;

  // Distinct anatomical proportions for Male vs. Female characters + Gym Muscle Growth
  const shoulderWidth = (isFemale ? 0.38 : 0.56) + muscleBoost * 1.4;
  const torsoWidth = (isFemale ? 0.33 : 0.46) + muscleBoost * 1.25;
  const waistWidth = (isFemale ? 0.25 : 0.41) + muscleBoost * 0.4;
  const hipWidth = isFemale ? 0.145 : 0.14;

  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.72,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.58,
    metalness: 0.06,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: appearance.shirtStyle === 'jacket' ? 0.42 : 0.76,
    metalness: appearance.shirtStyle === 'jacket' ? 0.14 : 0.04,
  });
  const accentShirtMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(appearance.shirtColor).multiplyScalar(0.75),
    roughness: 0.65,
    metalness: 0.08,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: appearance.pantsColor,
    roughness: 0.84,
    metalness: 0.02,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: '#eab308',
    roughness: 0.28,
    metalness: 0.72,
  });
  const kasavuMat = new THREE.MeshStandardMaterial({
    color: '#faf6eb',
    roughness: 0.82,
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

  // Ground contact shadow disc
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

  // Pelvis / Hips (Wider sculpted hips for female; straight cut for male)
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(isFemale ? 0.39 : torsoWidth * 0.96, 0.19, isFemale ? 0.26 : 0.24),
    isDress ? shirtMat : isMundu ? kasavuMat : pantsMat,
  );
  pelvis.position.y = 0.84;
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  // Waistband / Belt / Gold Sash
  if (isLehenga) {
    const goldBelt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.25), goldTrimMat);
    goldBelt.position.y = 0.94;
    bodyGroup.add(goldBelt);
  } else if (isMundu) {
    const kasavuBelt = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 1.0, 0.055, 0.255), goldTrimMat);
    kasavuBelt.position.y = 0.92;
    bodyGroup.add(kasavuBelt);
  } else if (!isDress) {
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(waistWidth * 1.04, 0.05, 0.245),
      darkMat,
    );
    belt.position.y = 0.93;
    bodyGroup.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.03), metalMat);
    buckle.position.set(0, 0.93, 0.125);
    bodyGroup.add(buckle);
  }

  // Torso (Hourglass tapered silhouette for Female vs. Broad muscular chest for Male)
  if (isFemale) {
    const upperTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth * 0.56, waistWidth * 0.52, 0.54, 14),
      shirtMat,
    );
    upperTorso.scale.set(1.08, 1, 0.72);
    upperTorso.position.y = 1.22;
    upperTorso.castShadow = true;
    upperTorso.receiveShadow = true;
    bodyGroup.add(upperTorso);

    // Subtle contoured bust silhouette for clear female distinction
    const bust = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 14, 12),
      shirtMat,
    );
    bust.scale.set(1.18, 0.78, 0.72);
    bust.position.set(0, 1.32, 0.075);
    bust.castShadow = true;
    bodyGroup.add(bust);
  } else {
    // Broad male shoulders & chest
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 1.05, 0.36, 0.27),
      shirtMat,
    );
    chest.position.y = 1.32;
    chest.castShadow = true;
    chest.receiveShadow = true;
    bodyGroup.add(chest);

    const abdomen = new THREE.Mesh(
      new THREE.BoxGeometry(waistWidth, 0.24, 0.24),
      shirtMat,
    );
    abdomen.position.y = 1.04;
    abdomen.castShadow = true;
    bodyGroup.add(abdomen);
  }

  // Gender-specific Clothing & Cultural Outfits
  if (isDress) {
    // Flared A-line Dress Skirt + Waist Ribbon
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(waistWidth * 0.58, 0.37, 0.66, 18),
      shirtMat,
    );
    skirt.position.y = 0.61;
    skirt.castShadow = true;
    bodyGroup.add(skirt);

    const ribbon = new THREE.Mesh(
      new THREE.CylinderGeometry(waistWidth * 0.61, waistWidth * 0.61, 0.065, 16),
      accentShirtMat,
    );
    ribbon.position.y = 0.96;
    bodyGroup.add(ribbon);

    const hemTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.362, 0.375, 0.04, 18),
      accentShirtMat,
    );
    hemTrim.position.y = 0.29;
    bodyGroup.add(hemTrim);
  } else if (isLehenga) {
    // Festive Lehenga Choli with Gold Bordered Flared Skirt & Dupatta
    const lehengaSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.42, 0.72, 20),
      pantsMat,
    );
    lehengaSkirt.position.y = 0.56;
    lehengaSkirt.castShadow = true;
    bodyGroup.add(lehengaSkirt);

    const goldHem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.425, 0.07, 20),
      goldTrimMat,
    );
    goldHem.position.y = 0.23;
    bodyGroup.add(goldHem);

    // Draped Dupatta across left shoulder
    const dupatta = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.68, 0.24),
      accentShirtMat,
    );
    dupatta.position.set(-0.14, 1.18, 0.03);
    dupatta.rotation.z = -0.32;
    bodyGroup.add(dupatta);
  } else if (isKurti) {
    // Long Flowing Kurti Tunic + Contrasting Dupatta Scarf
    const kurtiFlap = new THREE.Mesh(
      new THREE.CylinderGeometry(waistWidth * 0.58, 0.27, 0.44, 16),
      shirtMat,
    );
    kurtiFlap.position.y = 0.72;
    kurtiFlap.castShadow = true;
    bodyGroup.add(kurtiFlap);

    const dupatta = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.56, 0.23),
      goldTrimMat,
    );
    dupatta.position.set(0.14, 1.24, 0.02);
    dupatta.rotation.z = 0.24;
    bodyGroup.add(dupatta);
  } else if (isMundu) {
    // Kerala Traditional Kasavu Mundu (Ivory wrap with golden kasavu border) + Collared Shirt
    const munduWrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.23, 0.68, 16),
      kasavuMat,
    );
    munduWrap.position.y = 0.54;
    munduWrap.castShadow = true;
    bodyGroup.add(munduWrap);

    const kasavuBorder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.232, 0.234, 0.075, 16),
      goldTrimMat,
    );
    kasavuBorder.position.y = 0.25;
    bodyGroup.add(kasavuBorder);

    const shirtCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.07, 0.22),
      accentShirtMat,
    );
    shirtCollar.position.set(0, 1.5, 0);
    bodyGroup.add(shirtCollar);
  } else if (appearance.shirtStyle === 'jacket') {
    const innerTee = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.34, 0.54, 0.28),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.85 }),
    );
    innerTee.position.y = 1.22;
    bodyGroup.add(innerTee);

    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.78, 0.08, 0.28),
      accentShirtMat,
    );
    collar.position.set(0, 1.51, -0.01);
    bodyGroup.add(collar);
  } else if (appearance.shirtStyle === 'hoodie') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.18), accentShirtMat);
    hood.position.set(0, 1.5, -0.11);
    bodyGroup.add(hood);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.72, 0.16, 0.04),
      accentShirtMat,
    );
    pocket.position.set(0, 1.08, 0.14);
    bodyGroup.add(pocket);
  } else if (appearance.shirtStyle === 'polo' || appearance.shirtStyle === 'shirt') {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.07, 12),
      accentShirtMat,
    );
    collar.position.set(0, 1.52, 0);
    bodyGroup.add(collar);
    if (appearance.shirtStyle === 'shirt') {
      const placket = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.48, 0.02),
        accentShirtMat,
      );
      placket.position.set(0, 1.24, 0.14);
      bodyGroup.add(placket);
    }
  }

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(isFemale ? 0.062 : 0.085, isFemale ? 0.072 : 0.095, 0.12, 12),
    skinMat,
  );
  neck.position.y = 1.54;
  bodyGroup.add(neck);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.62;
  bodyGroup.add(headGroup);

  const head = isFemale
    ? new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 14), skinMat)
    : new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.34, 0.31), skinMat);
  if (isFemale) {
    head.scale.set(0.95, 1.05, 0.96);
  }
  head.position.y = 0.16;
  head.castShadow = true;
  headGroup.add(head);

  // Eyes, Brows & Female Makeup / Male Jaw Accents
  const eyeGeo = new THREE.SphereGeometry(isFemale ? 0.026 : 0.024, 10, 10);
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.068, 0.18, isFemale ? 0.155 : 0.158);
  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.068, 0.18, isFemale ? 0.155 : 0.158);
  headGroup.add(leftEye, rightEye);

  if (isFemale) {
    // Eyelashes, soft rosy blush & lip tint
    const lashMat = darkMat;
    const lashL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.015), lashMat);
    lashL.position.set(-0.072, 0.205, 0.158);
    lashL.rotation.z = 0.15;
    const lashR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.015), lashMat);
    lashR.position.set(0.072, 0.205, 0.158);
    lashR.rotation.z = -0.15;

    const blushMat = new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.9 });
    const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), blushMat);
    blushL.scale.set(1.2, 0.65, 0.35);
    blushL.position.set(-0.095, 0.135, 0.145);
    const blushR = blushL.clone();
    blushR.position.x = 0.095;

    const lipMat = new THREE.MeshStandardMaterial({ color: '#e11d48', roughness: 0.45 });
    const lips = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, 0.02), lipMat);
    lips.position.set(0, 0.095, 0.158);

    // Delicate gold earrings
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), goldTrimMat);
    earL.position.set(-0.165, 0.11, 0);
    const earR = earL.clone();
    earR.position.x = 0.165;

    headGroup.add(lashL, lashR, blushL, blushR, lips, earL, earR);
  } else {
    // Defined male eyebrows
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.018, 0.02), hairMat);
    browL.position.set(-0.072, 0.222, 0.158);
    const browR = browL.clone();
    browR.position.x = 0.072;
    headGroup.add(browL, browR);
  }

  // Hair styles (distinct female & male silhouettes)
  if (appearance.hairStyle === 'short') {
    const topHair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.11, 0.34), hairMat);
    topHair.position.set(0, 0.34, -0.01);
    topHair.castShadow = true;
    const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.1), hairMat);
    backHair.position.set(0, 0.22, -0.14);
    headGroup.add(topHair, backHair);
  } else if (appearance.hairStyle === 'fade') {
    const topHair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.32), hairMat);
    topHair.position.set(0, 0.35, 0.01);
    topHair.castShadow = true;
    const sideFade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.32), hairMat);
    sideFade.position.set(0, 0.28, -0.01);
    headGroup.add(topHair, sideFade);
  } else if (appearance.hairStyle === 'curly') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), hairMat);
      puff.position.set(Math.cos(a) * 0.11, 0.33 + (i % 2) * 0.03, Math.sin(a) * 0.11);
      headGroup.add(puff);
    }
    const crownPuff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), hairMat);
    crownPuff.position.set(0, 0.38, 0);
    headGroup.add(crownPuff);
  } else if (appearance.hairStyle === 'long') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), hairMat);
    crown.scale.set(1.02, 0.72, 1.02);
    crown.position.set(0, 0.27, -0.02);
    const drapeBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.54, 0.14), hairMat);
    drapeBack.position.set(0, 0.04, -0.13);
    drapeBack.castShadow = true;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.18), hairMat);
    sideL.position.set(-0.16, 0.09, -0.02);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.18), hairMat);
    sideR.position.set(0.16, 0.09, -0.02);
    headGroup.add(crown, drapeBack, sideL, sideR);
  } else if (appearance.hairStyle === 'braids') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), hairMat);
    crown.scale.set(1.02, 0.72, 1.02);
    crown.position.set(0, 0.27, -0.02);
    headGroup.add(crown);
    for (const side of [-1, 1]) {
      for (let seg = 0; seg < 4; seg++) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.055 - seg * 0.005, 8, 8), hairMat);
        bead.position.set(side * 0.16, 0.14 - seg * 0.09, -0.05);
        headGroup.add(bead);
      }
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), goldTrimMat);
      tie.position.set(side * 0.16, -0.2, -0.05);
      headGroup.add(tie);
    }
  } else if (appearance.hairStyle === 'spiky') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.33), hairMat);
    base.position.set(0, 0.33, 0);
    headGroup.add(base);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 6), hairMat);
      spike.position.set(i * 0.09, 0.43, 0.02);
      spike.rotation.x = 0.22;
      headGroup.add(spike);
    }
  } else if (appearance.hairStyle === 'bob') {
    const bobCap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), hairMat);
    bobCap.scale.set(1.05, 0.95, 1.05);
    bobCap.position.set(0, 0.22, -0.04);
    headGroup.add(bobCap);
  } else if (appearance.hairStyle === 'ponytail') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), hairMat);
    crown.scale.set(1.0, 0.72, 1.0);
    crown.position.set(0, 0.27, -0.01);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 12), goldTrimMat);
    band.position.set(0, 0.25, -0.19);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.38, 10), hairMat);
    tail.position.set(0, 0.12, -0.24);
    tail.rotation.x = 0.38;
    headGroup.add(crown, band, tail);
  }

  // Accessories
  if (appearance.accessory === 'glasses') {
    const lensMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.1,
      metalness: 0.8,
    });
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.025), lensMat);
    frameL.position.set(-0.072, 0.18, 0.172);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.025), lensMat);
    frameR.position.set(0.072, 0.18, 0.172);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), metalMat);
    bridge.position.set(0, 0.19, 0.172);
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

  // Arms (Slender for female, broader for male + gym muscle boost)
  const armThick = (isFemale ? 0.105 : 0.14) + muscleBoost * 0.45;
  const buildArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * (shoulderWidth * 0.5 + 0.05), 1.44, 0);

    const shortSleeve =
      appearance.shirtStyle === 'tee' ||
      appearance.shirtStyle === 'polo' ||
      isDress ||
      isLehenga;
    const sleeveLen = shortSleeve ? 0.2 : 0.44;
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(armThick, sleeveLen, armThick + 0.01),
      shirtMat,
    );
    upper.position.y = -sleeveLen * 0.5;
    upper.castShadow = true;
    arm.add(upper);

    const forearmLen = 0.52 - sleeveLen;
    if (forearmLen > 0.04) {
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(armThick * 0.85, forearmLen, armThick * 0.9),
        skinMat,
      );
      lower.position.y = -sleeveLen - forearmLen * 0.5;
      lower.castShadow = true;
      arm.add(lower);
    }

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.095, 0.1), skinMat);
    hand.position.y = -0.55;
    arm.add(hand);

    bodyGroup.add(arm);
    return arm;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Held Item Mount in Right Hand (Tea, Latte, Juice, Snack, Football, Volleyball, Cricket Bat)
  const heldItemGroup = new THREE.Group();
  heldItemGroup.position.set(0, -0.58, 0.09);
  rightArm.add(heldItemGroup);

  // Legs (Show skin lower legs under dresses, slim legs for female, straight trousers for male)
  const legW = isFemale ? 0.125 : 0.16;
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * hipWidth, 0.78, 0);

    const pantMatForLeg = hasSkirt ? skinMat : isMundu ? kasavuMat : pantsMat;
    const pant = new THREE.Mesh(new THREE.BoxGeometry(legW, 0.64, legW + 0.02), pantMatForLeg);
    pant.position.y = -0.32;
    pant.castShadow = true;
    leg.add(pant);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.015, 0.1, 0.24), shoeMat);
    shoe.position.set(0, -0.695, 0.035);
    shoe.castShadow = true;
    leg.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.02, 0.032, 0.25), soleMat);
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

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    heldItemGroup,
    currentHeldItem: 'none',
    dispose,
  };
}

function clearHeldItemGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}

export function setCharacterHeldItem(rig: CharacterRig, item: HeldItemType): void {
  if (rig.currentHeldItem === item) return;
  rig.currentHeldItem = item;
  clearHeldItemGroup(rig.heldItemGroup);
  if (item === 'none') return;

  if (item === 'tea' || item === 'latte') {
    // Kerala Chaya Glass / Brass Tumbler with hot liquid & visible rising steam puff
    const cupMat = new THREE.MeshStandardMaterial({
      color: item === 'tea' ? '#e2e8f0' : '#f8fafc',
      roughness: 0.25,
      metalness: item === 'tea' ? 0.35 : 0.1,
    });
    const liquidMat = new THREE.MeshStandardMaterial({
      color: item === 'tea' ? '#b45309' : '#65a30d',
      roughness: 0.2,
    });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.044, 0.15, 12), cupMat);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.046, 0.03, 12), liquidMat);
    liquid.position.y = 0.064;
    const steamMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
    });
    const steam = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), steamMat);
    steam.position.y = 0.13;
    rig.heldItemGroup.add(cup, liquid, steam);
  } else if (item === 'juice') {
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#f97316',
      roughness: 0.22,
      transparent: true,
      opacity: 0.9,
    });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.042, 0.17, 12), glassMat);
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: '#ec4899' }),
    );
    straw.position.set(0.02, 0.08, 0);
    straw.rotation.z = -0.25;
    rig.heldItemGroup.add(cup, straw);
  } else if (item === 'snack') {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.02, 14),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 }),
    );
    const pazham = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.72 }),
    );
    pazham.position.y = 0.035;
    rig.heldItemGroup.add(plate, pazham);
  } else if (item === 'football' || item === 'volleyball') {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 12),
      new THREE.MeshStandardMaterial({
        color: item === 'football' ? '#f8fafc' : '#fde047',
        roughness: 0.45,
      }),
    );
    ball.position.set(0, -0.02, 0.08);
    rig.heldItemGroup.add(ball);
  } else if (item === 'cricket_bat') {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 }),
    );
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.56, 0.035),
      new THREE.MeshStandardMaterial({ color: '#d6b37d', roughness: 0.72 }),
    );
    blade.position.y = -0.35;
    rig.heldItemGroup.add(handle, blade);
  }
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
    targetRA = rig.currentHeldItem !== 'none' ? -0.95 : swing * 0.45;
    targetBodyY = Math.abs(Math.cos(elapsed * 8.5)) * 0.05;
  } else if (anim === 'run') {
    const swing = Math.sin(elapsed * 13.5);
    targetL = swing * 0.92;
    targetR = -swing * 0.92;
    targetLA = -swing * 0.85;
    targetRA = rig.currentHeldItem !== 'none' ? -1.05 : swing * 0.85;
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
  } else if (anim === 'drink') {
    // Smooth sipping tea/coffee/juice animation raising right hand toward mouth
    const sip = (Math.sin(elapsed * 3.8) + 1) * 0.5;
    targetRA = -1.35 - sip * 0.82;
    targetRAZ = 0.32 + sip * 0.12;
    targetHeadY = Math.sin(elapsed * 1.6) * 0.08;
    targetBodyY = Math.sin(elapsed * 2.2) * 0.015;
  } else if (anim === 'eat') {
    const bite = (Math.sin(elapsed * 4.8) + 1) * 0.5;
    targetRA = -1.2 - bite * 0.88;
    targetRAZ = 0.28;
    targetLA = -0.5;
    targetBodyY = Math.sin(elapsed * 2.6) * 0.018;
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
    targetBodyY = Math.sin(elapsed * 2.2) * 0.015;
    targetHeadY = Math.sin(elapsed * 1.1) * 0.05;
    if (rig.currentHeldItem !== 'none') {
      targetRA = -0.95;
      targetRAZ = 0.15;
    }
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

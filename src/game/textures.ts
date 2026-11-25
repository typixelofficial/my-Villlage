import * as THREE from 'three';

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5c9c4e';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle organic meadow flecks
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137 + Math.floor(i / 256) * 29) % 256;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(126, 186, 92, 0.32)' : 'rgba(62, 114, 52, 0.25)';
    ctx.fillRect(x, y, 2 + (i % 3), 4 + (i % 4));
  }

  return finalizeColorTexture(canvas, 42, 42, maxAnisotropy);
}

export function createRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm slate asphalt
  ctx.fillStyle = '#333b44';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle asphalt grain
  for (let i = 0; i < 900; i++) {
    const x = (i * 59) % 256;
    const y = (i * 97) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Sidewalks / crisp shoulder stripes
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(8, 0, 5, 256);
  ctx.fillRect(243, 0, 5, 256);

  // Dashed center line
  ctx.fillStyle = '#f59e0b';
  for (let y = 12; y < 256; y += 52) {
    ctx.fillRect(125, y, 6, 28);
  }

  return finalizeColorTexture(canvas, 1, 18, maxAnisotropy);
}

export function createCobbleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b7aa97';
  ctx.fillRect(0, 0, 256, 256);

  const stoneColors = ['#cbbba4', '#bdaea0', '#d5c7b2', '#aa9d8d'];
  for (let row = 0; row < 16; row++) {
    const offset = (row % 2) * 14;
    for (let col = -1; col < 10; col++) {
      ctx.fillStyle = stoneColors[(row * 5 + col * 3 + 16) % stoneColors.length];
      ctx.fillRect(col * 28 + offset + 2, row * 16 + 2, 24, 12);
    }
  }

  return finalizeColorTexture(canvas, 8, 8, maxAnisotropy);
}

export function createWaterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1f88b8';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 42; i++) {
    const y = (i * 29) % 256;
    const x = (i * 67) % 256;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
    ctx.fillRect(x, y, 36 + (i % 24), 3);
  }

  return finalizeColorTexture(canvas, 14, 14, maxAnisotropy);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createSignTexture(title: string, subtitle: string, accent = '#10b981'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 512, 10);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 38px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.slice(0, 26), 256, 54);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle.slice(0, 36), 256, 98);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createNameplateSprite(
  displayName: string,
  subtitle?: string,
  chatBubble?: string,
  accentColor = '#10b981',
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const spriteMat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(3.2, 1.2, 1);
  updateNameplateCanvas(sprite, canvas, displayName, subtitle, chatBubble, accentColor);
  sprite.userData.canvas = canvas;
  return sprite;
}

export function updateNameplateCanvas(
  sprite: THREE.Sprite,
  canvas: HTMLCanvasElement,
  displayName: string,
  subtitle?: string,
  chatBubble?: string,
  accentColor = '#10b981',
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 192);

  // Optional chat bubble above name
  if (chatBubble) {
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    const trimmed = chatBubble.slice(0, 44);
    const bubbleW = Math.min(480, Math.max(120, ctx.measureText(trimmed).width + 36));
    const bx = (512 - bubbleW) / 2;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.94)';
    ctx.beginPath();
    ctx.roundRect(bx, 12, bubbleW, 48, 12);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(trimmed, 256, 36);
  }

  // Name bar
  ctx.font = '700 28px Outfit, sans-serif';
  const nameText = displayName.slice(0, 22);
  const textWidth = ctx.measureText(nameText).width;
  const subWidth = subtitle ? subtitle.length * 12 : 0;
  const pillW = Math.min(440, Math.max(160, Math.max(textWidth, subWidth) + 54));
  const px = (512 - pillW) / 2;
  const py = 82;
  const ph = subtitle ? 76 : 52;

  ctx.fillStyle = 'rgba(11, 16, 20, 0.84)';
  ctx.beginPath();
  ctx.roundRect(px, py, pillW, ph, 10);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle accent dot on left of nameplate
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(px + 20, py + (subtitle ? 26 : 26), 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nameText, 256 + 6, py + 26);

  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle.slice(0, 32), 256, py + 56);
  }

  const mat = sprite.material as THREE.SpriteMaterial;
  if (mat.map) mat.map.dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  mat.map = tex;
  mat.needsUpdate = true;
}

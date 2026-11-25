import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AnimationState, CharacterAppearance } from '../shared/types.ts';
import { buildCharacterRig, animateCharacterRig, type CharacterRig } from '../game/characterMesh.ts';
import {
  detectSoftwareGl,
  scheduleSoftwareAfterDraw,
  setupStudioEnvironment,
} from '../game/glUtils.ts';

interface CharacterPreviewCanvasProps {
  appearance: CharacterAppearance;
  previewAnim: AnimationState;
}

export function CharacterPreviewCanvas({
  appearance,
  previewAnim,
}: CharacterPreviewCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationState>(previewAnim);
  const rigRef = useRef<CharacterRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rotYRef = useRef(0.28);

  animRef.current = previewAnim;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111920');
    scene.fog = new THREE.FogExp2('#111920', 0.045);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      60,
    );
    camera.position.set(0, 1.55, 4.1);
    camera.lookAt(0, 1.0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const envTex = setupStudioEnvironment(renderer, scene);

    // 3-Point Studio Lighting Rig
    const hemi = new THREE.HemisphereLight('#cfe8ff', '#27362b', 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff2dc', 2.0);
    keyLight.position.set(3.5, 6, 4.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#6ee7b7', 1.1);
    rimLight.position.set(-4, 4, -4);
    scene.add(rimLight);

    // Studio Stone Pedestal & Subtle Floor Ring
    const pedestalGeo = new THREE.CylinderGeometry(1.05, 1.18, 0.24, 36);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.45,
      metalness: 0.35,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.12;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ringGeo = new THREE.RingGeometry(1.06, 1.12, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    const floorGeo = new THREE.CircleGeometry(14, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0e151b',
      roughness: 0.88,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.24;
    floor.receiveShadow = true;
    scene.add(floor);

    // Build initial rig
    const initialRig = buildCharacterRig(appearance);
    initialRig.root.rotation.y = rotYRef.current;
    scene.add(initialRig.root);
    rigRef.current = initialRig;

    // Interactive 360-degree drag turntable
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rotYRef.current += dx * 0.012;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let prevTime = performance.now();
    let elapsed = 0;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - prevTime) / 1000);
      prevTime = now;
      elapsed += dt;

      if (!dragging) {
        rotYRef.current += dt * 0.25;
      }
      if (rigRef.current) {
        rigRef.current.root.rotation.y = rotYRef.current;
        animateCharacterRig(rigRef.current, animRef.current, dt, elapsed);
      }

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
      window.clearTimeout(timerId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      rigRef.current?.dispose();
      pedestalGeo.dispose();
      pedestalMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      envTex.dispose();
      renderer.dispose();
      sceneRef.current = null;
      rigRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild 3D rig whenever customization options change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      rigRef.current.dispose();
    }
    const nextRig = buildCharacterRig(appearance);
    nextRig.root.rotation.y = rotYRef.current;
    scene.add(nextRig.root);
    rigRef.current = nextRig;
  }, [appearance]);

  return <div ref={mountRef} className="w-full h-full relative select-none" />;
}

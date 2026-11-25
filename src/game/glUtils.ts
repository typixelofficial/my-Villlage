import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  if (typeof document === 'undefined') {
    cachedIsSoftwareGl = false;
    return false;
  }
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = false;
    return false;
  }
}

export function setupStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();
  return envTex;
}

export function scheduleSoftwareAfterDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  setTimerId: (id: number) => void,
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  if (!gl || typeof gl.fenceSync !== 'function') {
    setTimerId(window.setTimeout(cb, 80));
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    if (state === gl.UNSIGNALED) {
      setTimerId(window.setTimeout(poll, 5));
    } else {
      if (sync) gl.deleteSync(sync);
      setTimerId(window.setTimeout(cb, 80));
    }
  };
  setTimerId(window.setTimeout(poll, 5));
}

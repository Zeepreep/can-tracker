import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { canProfile, type P } from './profile';
import { specFor, type CanSpec } from './specs';
import { drawLabel, type LabelData } from './label';

export interface CanViewer { update(d: LabelData): void; snapshot(): string | null; dispose(): void; }

const SEGMENTS = 96;
const lathe = (pts: P[], phiStart = 0) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), SEGMENTS, phiStart);

function buildCan(spec: CanSpec, metal: THREE.Material, print: THREE.Material, tabMat: THREE.Material): THREE.Group {
  const p = canProfile(spec); const g = new THREE.Group();
  // body wall: seam of the label at the back (phi = PI), front of the label (u = 0.5) faces +z
  g.add(new THREE.Mesh(lathe(p.body, Math.PI), print));
  for (const part of [p.base, p.top, p.lid]) g.add(new THREE.Mesh(lathe(part), metal));
  // pull tab (flat oval with a finger hole) and rivet, on the lid panel
  const lidY = spec.height - 5.5 + 0.35;
  const shape = new THREE.Shape(); const w = 9.5, h = 5.6;
  shape.absellipse(0, 0, w, h, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(); hole.absellipse(w * 0.35, 0, w * 0.42, h * 0.58, 0, Math.PI * 2, true, 0); shape.holes.push(hole);
  const tab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 24 }), tabMat);
  tab.rotation.x = -Math.PI / 2; tab.position.set(-spec.neckPlugDia * 0.1, lidY + 1.0, 0);
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.6, 20), tabMat); rivet.position.set(-spec.neckPlugDia * 0.1 - w * 0.55, lidY + 0.8, 0);
  g.add(tab, rivet);
  return g;
}

export async function createViewer(host: HTMLElement, initial: LabelData): Promise<CanViewer> {
  const label = document.createElement('canvas');
  let data = initial; let spec = specFor(data.size);
  drawLabel(label, data);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  } catch {
    // No WebGL: show the flat label instead (still shows colour, flavour, tagline and country).
    label.style.cssText = 'width:100%;border-radius:10px';
    host.replaceChildren(label);
    return { update(d) { data = d; drawLabel(label, d); }, snapshot: () => label.toDataURL('image/png'), dispose() { label.remove(); } };
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex;
  scene.add(new THREE.DirectionalLight(0xffffff, 0.9).translateX(80).translateY(120).translateZ(160));

  const tex = new THREE.CanvasTexture(label);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.wrapS = THREE.RepeatWrapping;
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dce1, metalness: 1, roughness: 0.3 });
  const tabMat = new THREE.MeshStandardMaterial({ color: 0xc6c9ce, metalness: 1, roughness: 0.38 });
  const print = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.34, envMapIntensity: 0.7 });

  let can = buildCan(spec, metal, print, tabMat);
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(can);

  const camera = new THREE.PerspectiveCamera(28, 1, 1, 2000);
  const center = () => new THREE.Vector3(0, spec.height / 2, 0);
  const PITCH = 0.22;
  function fit() {
    const w = host.clientWidth || 300, h = host.clientHeight || 340;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = Math.max((spec.height / 2 / Math.tan(vf / 2)), (spec.diameter / 2 / Math.tan(hf / 2))) * 1.22 + spec.diameter / 2;
    const c = center();
    camera.position.set(0, c.y + dist * Math.sin(PITCH), dist * Math.cos(PITCH)); camera.lookAt(c); camera.updateProjectionMatrix();
    pivot.position.set(0, 0, 0);
  }
  const ro = new ResizeObserver(fit); ro.observe(host); fit();

  // drag to spin (horizontal), with inertia; slow auto-spin until the first touch
  let yaw = 0.0, vel = 0, dragging = false, lastX = 0, interacted = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { dragging = true; interacted = true; lastX = e.clientX; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; yaw += dx * 0.012; vel = dx * 0.012; });
  const end = () => { dragging = false; el.style.cursor = 'grab'; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!dragging) { yaw += vel; vel *= 0.94; if (!interacted && !reduced) yaw += dt * 0.5; }
    pivot.rotation.y = yaw;
    renderer.render(scene, camera);
  });

  const disposeCan = () => { can.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); pivot.remove(can); };
  return {
    update(d) {
      data = d; drawLabel(label, d); tex.needsUpdate = true;
      const next = specFor(d.size);
      if (next.id !== spec.id) { disposeCan(); spec = next; can = buildCan(spec, metal, print, tabMat); pivot.add(can); fit(); }
    },
    snapshot() { renderer.render(scene, camera); return el.toDataURL('image/png'); },
    dispose() {
      renderer.setAnimationLoop(null); ro.disconnect(); disposeCan();
      tex.dispose(); metal.dispose(); tabMat.dispose(); print.dispose(); envTex.dispose(); pmrem.dispose(); renderer.dispose(); el.remove();
    },
  };
}

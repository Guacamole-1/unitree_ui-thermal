import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RobotModel } from './robot-model';
import { VoxelMap } from './voxel-map';
import { theme } from '../theme';

export class Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  robotModel: RobotModel;
  voxelMap: VoxelMap;
  private animationId: number = 0;
  private grid: THREE.GridHelper | null = null;
  private unsubTheme: () => void = () => {};

  // View toggle state (double-tap). Default 'follow' mirrors the Go2
  // APK (viewType=0): the camera sits just behind the robot looking
  // forward, with fog and orbit locked. The alternate 'overview'
  // (viewType=1 in the APK) zooms out for a holistic top-down look
  // with orbit enabled.
  private viewType: 'overview' | 'follow' = 'follow';
  private lastTapTime = 0;
  private lastTapX = 0;
  private savedCameraPos = new THREE.Vector3(-1.2, 0, 1);
  private savedTarget = new THREE.Vector3(4, 0, 0);
  /** Fires when the view mode toggles (APK shows toastMsg_4 / _5). The
   *  host App subscribes to render a toast — we don't take a DOM ref
   *  here because the scene shouldn't own UI chrome. */
  onViewChange: ((view: 'overview' | 'follow') => void) | null = null;

  // APK camera offsets (Go2 frontend 1.11.4).
  // Robot-local frame: X is forward, Y is left, Z is up.
  private static readonly FOLLOW_CAMERA_OFFSET = new THREE.Vector3(-1.2, 0, 1);
  private static readonly FOLLOW_LOOKAT_OFFSET = new THREE.Vector3(4, 0, 0);
  private static readonly OVERVIEW_CAMERA_OFFSET = new THREE.Vector3(-3, 0, 3);
  // Fog tuned to the APK: dark background colour, near=0.015, far=20.
  private static readonly FOLLOW_FOG = new THREE.Fog(0x282828, 0.015, 20);
  // Robot spawns 0.3 m below world origin (BODY_HEIGHT_OFFSET in
  // robot-model.ts). Hard-coded here so the initial camera frames
  // correctly before the GLB finishes loading and getPosition()
  // returns a real value.
  private static readonly INITIAL_ROBOT_POS = new THREE.Vector3(0, 0, -0.3);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    // Theme-aware background (APK dark = 0x282828; light = near-white)
    this.scene.background = new THREE.Color(theme().colors.background);
    // Follow is the default view, so the APK fog is on from the start.
    this.scene.fog = Scene3D.FOLLOW_FOG;

    // FOV matches the APK (PerspectiveCamera(70)). The previous 50°
    // truncated the dog from the bottom of the frame when the camera
    // sat 1 m above and 1.2 m behind a dog at z = -0.3 — 29° below
    // the view ray fell outside a 25° half-FOV.
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
    // Initial follow-view placement — anchor on the robot's spawn
    // pose (z = -0.3 from BODY_HEIGHT_OFFSET) plus the APK offsets.
    this.camera.position.copy(Scene3D.INITIAL_ROBOT_POS).add(Scene3D.FOLLOW_CAMERA_OFFSET);
    this.camera.up.set(0, 0, 1);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(Scene3D.INITIAL_ROBOT_POS).add(Scene3D.FOLLOW_LOOKAT_OFFSET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 20;
    // Orbit is disabled while in follow mode — the camera tracks the
    // dog's yaw and the user can't break that with a finger drag.
    this.controls.enabled = false;
    this.controls.update();

    this.setupLights();
    this.setupGrid();
    this.loadEnvironment();

    this.robotModel = new RobotModel(this.scene);
    this.voxelMap = new VoxelMap(this.scene);

    // Double-tap detection on canvas
    canvas.addEventListener('pointerdown', (e) => this.handleDoubleTap(e));

    // Re-apply background + grid on theme change
    this.unsubTheme = theme().onChange((_t, colors) => {
      this.scene.background = new THREE.Color(colors.background);
      this.rebuildGrid(colors.grid);
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, -5, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 30;
    dir.shadow.camera.left = -5;
    dir.shadow.camera.right = 5;
    dir.shadow.camera.top = 5;
    dir.shadow.camera.bottom = -5;
    this.scene.add(dir);

    const hemi = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.4);
    this.scene.add(hemi);
  }

  private setupGrid(): void {
    this.rebuildGrid(theme().colors.grid);
  }

  private rebuildGrid(color: number): void {
    if (this.grid) {
      this.scene.remove(this.grid);
      (this.grid.material as THREE.Material).dispose?.();
      this.grid.geometry.dispose();
    }
    const g = new THREE.GridHelper(40, 40, color, color);
    g.rotateX(Math.PI / 2);
    this.scene.add(g);
    this.grid = g;
  }

  private loadEnvironment(): void {
    new HDRLoader().load('/models/venice_sunset_1k.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
    });
  }

  private handleDoubleTap(e: PointerEvent): void {
    const now = performance.now();
    if (now - this.lastTapTime < 300 && Math.abs(e.clientX - this.lastTapX) <= 60) {
      this.toggleView();
    }
    this.lastTapTime = now;
    this.lastTapX = e.clientX;
  }

  private toggleView(): void {
    const robotPos = this.robotModel.getPosition();
    if (this.viewType === 'follow') {
      // Switch to overview: pull back to (-3, 0, 3) (rotated by the
      // robot's current yaw so we end up behind it), look at the robot,
      // drop the fog, re-enable orbit. Matches the APK's viewType=1.
      this.savedCameraPos.copy(this.camera.position);
      this.savedTarget.copy(this.controls.target);

      const yawOffset = this.yawRotated(Scene3D.OVERVIEW_CAMERA_OFFSET);
      this.animateCamera(
        robotPos.clone().add(yawOffset),
        robotPos.clone(),
      );
      this.scene.fog = null;
      this.controls.enabled = true;
      this.viewType = 'overview';
    } else {
      // Switch to follow view: snap behind the robot (yaw-rotated
      // -1.2, 0, 1) looking 4 m forward, with fog, orbit locked.
      // Matches the APK's viewType=0.
      const camOffset = this.yawRotated(Scene3D.FOLLOW_CAMERA_OFFSET);
      const lookOffset = this.yawRotated(Scene3D.FOLLOW_LOOKAT_OFFSET);
      this.animateCamera(
        robotPos.clone().add(camOffset),
        robotPos.clone().add(lookOffset),
      );
      this.scene.fog = Scene3D.FOLLOW_FOG;
      this.controls.enabled = false;
      this.viewType = 'follow';
    }
    this.onViewChange?.(this.viewType);
  }

  /** Apply only the robot's yaw (rotation around Z) to a local-frame
   *  offset, leaving the Z component untouched. Mirrors the APK's
   *  rotatePointInPlane usage in calFirstViewCameraPosition. */
  private yawRotated(localOffset: THREE.Vector3): THREE.Vector3 {
    const yaw = new THREE.Euler().setFromQuaternion(this.robotModel.getQuaternion(), 'ZYX').z;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    return new THREE.Vector3(
      localOffset.x * cos - localOffset.y * sin,
      localOffset.x * sin + localOffset.y * cos,
      localOffset.z,
    );
  }

  /** Per-frame anchor for follow mode: keep the camera glued to the
   *  robot at the yaw-rotated offset. Skipped while a toggle animation
   *  is in progress so the tween isn't fought. */
  private updateFollowCamera(): void {
    if (this.viewType !== 'follow' || this.tweenInProgress) return;
    const robotPos = this.robotModel.getPosition();
    const camOffset = this.yawRotated(Scene3D.FOLLOW_CAMERA_OFFSET);
    const lookOffset = this.yawRotated(Scene3D.FOLLOW_LOOKAT_OFFSET);
    this.camera.position.copy(robotPos).add(camOffset);
    this.controls.target.copy(robotPos).add(lookOffset);
  }

  private tweenInProgress = false;

  private animateCamera(targetPos: THREE.Vector3, targetLookAt: THREE.Vector3): void {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 500;
    const startTime = performance.now();

    this.tweenInProgress = true;
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = t * (2 - t); // ease-out
      this.camera.position.lerpVectors(startPos, targetPos, eased);
      this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
      this.controls.update();
      if (t < 1) requestAnimationFrame(step);
      else this.tweenInProgress = false;
    };
    requestAnimationFrame(step);
  }

  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.updateFollowCamera();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.unsubTheme();
    this.renderer.dispose();
  }
}

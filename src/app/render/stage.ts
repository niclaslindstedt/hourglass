// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as THREE from "three";

import type { Layout } from "../glass.ts";
import { SAND, type Look } from "../look.ts";
import { airborne, streamPath, wallAt, type StreamPath } from "../physics.ts";
import { AIR_CAP, type Bulb } from "../sand.ts";
import {
  rimHeights,
  surfaceIndex,
  surfaceInto,
  surfaceVertexCount,
} from "../sandMesh.ts";
import { VIEW_HEADING, type SkyLook } from "../sky.ts";
import type { View } from "../view.ts";
import { disposeGroup, frameGroup, glassMaterial, glassMesh } from "./parts.ts";
import { createSkyDome, MIRROR_SUN, type SkyDome } from "./skyDome.ts";
import { sandTextures } from "./textures.ts";

// The picture, in three dimensions: the glass on a stage with the sky
// round it, drawn by three.js.
//
// THE PHONE IS A WINDOW. The scene is the world, its axes the sky's (x
// east, y up, z south). The camera and the glass hang together in one
// group, turned by the phone's own orientation (`orientation`), so tilting
// the phone turns the view of the sky the way a window's view turns — the
// horizon stays level with the real one, the sun stands where it stands —
// while the glass stays in front of the lens, because it is the phone.
// Inside that group the glass hangs a little loose (`view.ts`: the lag, the
// finger's orbit, the tap's half turn), so it is seen from a hair to one
// side for a moment when the phone is swung.
//
// THE LIGHT is the sky's (`sky.ts`): the key — the sun by day, the moon by
// night — as a directional light that casts the frame's shadows onto the
// sand, the dome's own light as a hemisphere, and the dome itself,
// rendered into an environment map, as everything the glass and the metal
// reflect. So the sun's highlight moves across the glass as the phone
// turns, and the glass at night holds the moon.
//
// THE SAND is the heaps `sand.ts` keeps: each bulb's surface as a mesh
// (`sandMesh.ts`), its body against the glass as the wall cut at the height
// the heap meets it, the grains in the air as lit balls the size of the
// sand each carries, and the stream from the waist to the heap under it.
// The bulbs are drawn in their own frames — heights from the end they rest
// against — so an upside-down glass is a group flipped along its axis, and
// a tap's turn that has handed the sand over holds them half a turn round
// the glass's own axis, where the sand is.

export type StageFrame = {
  look: Look;
  layout: Layout;
  source: Bulb;
  sink: Bulb;
  /** Which way the heaps hang in the glass: +1 when the source is the upper
   *  bulb, −1 when the phone is upside down and it is the lower. */
  gravity: 1 | -1;
  /** The tap's half turn, rad about the axis into the screen. */
  flip: number;
  /** Whether a tap's turn has handed the sand to the other ends already:
   *  the heaps are then held half a turn round the glass's own axis, so
   *  they stay where they were. */
  turned?: boolean;
  /** Whether the frame stands the other way up: each tap's turn leaves it
   *  so, finials and all, the way a real one is left — the glass is the
   *  same either way up, the frame is not. */
  upended?: boolean;
  view: View;
  /** The phone's orientation, device to Earth (`deviceToEarth`), or null
   *  for a glass held upright facing the default heading. */
  orientation: number[] | null;
  sky: SkyLook;
  /** How far the cloud has drifted, and seconds for what twinkles. */
  drift: number;
  seconds: number;
  /** The glass's height, as a share of the view's height. */
  size: number;
  /** How strong the stream runs, 0..1, and where across the sink bulb it
   *  lands (its lean, as the sink's tilt). */
  flow: number;
  /** The light behind the glass once the sand has run out, 0..1. */
  glow: number;
  /** The stream's path this frame (`streamPath`), when the loop has traced
   *  it already; traced here otherwise. */
  stream?: StreamPath | null;
};

/** The camera's field of view, degrees, and its distance from the waist. */
const FOV = 30;
const DISTANCE = 3.2;

/** How many grains fall down the stream at once. */
const STREAM_GRAINS = 64;

/** A grain in the air is drawn as a clump the size of the sand it carries
 *  (a ball of its volume), never smaller than this: a stray grain thrown
 *  by a shake is still seen. Units of the glass's height. */
const GRAIN_MIN = 0.003;

/** How big a grain running down the stream is, as a share of the bore. */
const STREAM_GRAIN = 0.4;

/** How many times the sand's speckle repeats across a unit of height. */
const GRAIN_REPEAT = 6;

/** The photographed grain (`public/models/grain.png`, from the Blender
 *  pipeline's CC0 sand), as the sand's bump: fetched once from this
 *  origin, like any other file, and the sand drawn smooth until it is. */
let grainBump: THREE.Texture | null = null;
function loadGrainBump(): THREE.Texture {
  if (!grainBump) {
    grainBump = new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}models/grain.png`,
    );
    grainBump.wrapS = THREE.RepeatWrapping;
    grainBump.wrapT = THREE.RepeatWrapping;
  }
  return grainBump;
}

type BulbView = {
  group: THREE.Group;
  surface: THREE.Mesh;
  positions: Float32Array;
  presence: Float32Array;
  uvs: Float32Array;
  skin: THREE.Mesh;
  rims: Float32Array;
  air: THREE.InstancedMesh;
};

/** A sand material that drops what is not sand: a vertex's `presence`
 *  under a half, or — on the skin — the wall above the height the heap
 *  meets it on that spoke. */
function sandMaterial(
  look: Look,
  textures: { map: THREE.Texture; rough: THREE.Texture; bump: THREE.Texture },
  rims: Float32Array | null,
): THREE.MeshStandardMaterial {
  const spec = SAND[look.sand];
  const material = new THREE.MeshStandardMaterial({
    map: textures.map,
    roughnessMap: textures.rough,
    roughness: 1,
    metalness: spec.sparkle ? 0.35 : 0,
    bumpMap: textures.bump,
    bumpScale: 0.6,
    // The sky's light on sand is a fill, not a flood: most of a clear
    // day's light is the sun's.
    envMapIntensity: 0.45,
    side: THREE.DoubleSide,
  });
  const m = rims?.length ?? 0;
  material.onBeforeCompile = (shader) => {
    if (rims) {
      shader.uniforms.uRim = { value: rims };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvLocal = position;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\nvarying vec3 vLocal;\nuniform float uRim[${m}];`,
        )
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
          {
            float t = atan(vLocal.z, vLocal.x);
            if (t < 0.0) t += 6.28318530718;
            float a = t / 6.28318530718 * ${m}.0 - 0.5;
            if (a < 0.0) a += ${m}.0;
            int i0 = int(floor(a));
            int i1 = i0 + 1;
            if (i1 >= ${m}) i1 = 0;
            float r0 = uRim[i0];
            float r1 = uRim[i1];
            if (r0 < 0.0 && r1 < 0.0) discard;
            if (r0 < 0.0) r0 = r1;
            if (r1 < 0.0) r1 = r0;
            if (vLocal.y > mix(r0, r1, fract(a))) discard;
          }`,
        );
    } else {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float presence;\nvarying float vPresence;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvPresence = presence;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vPresence;",
        )
        .replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif (vPresence < 0.5) discard;",
        );
    }
  };
  material.customProgramCacheKey = () => (rims ? `skin${m}` : "surface");
  return material;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private phone = new THREE.Group();
  private holder = new THREE.Group();
  private glassGroup = new THREE.Group();
  private camera: THREE.PerspectiveCamera;
  private dome: SkyDome;
  private envDome: SkyDome;
  private envScene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private env: THREE.WebGLRenderTarget | null = null;
  private envKey = "";
  private key = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private fill = new THREE.DirectionalLight(0xffffff, 0.2);
  private glowLight = new THREE.PointLight(0xfff0d0, 0, 1.5, 2);
  private look: Look | null = null;
  private parts: THREE.Group | null = null;
  private heaps = new THREE.Group();
  private frame = new THREE.Group();
  private bulbs: BulbView[] = [];
  private stream: THREE.Mesh | null = null;
  private streamGrains: THREE.InstancedMesh | null = null;
  private streamKey = "";
  private sandMaterials: THREE.Material[] = [];
  private basis = new THREE.Matrix4();
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 200);
    this.camera.position.set(0, 0, DISTANCE);
    this.camera.lookAt(0, 0, 0);
    this.phone.add(this.camera);
    this.phone.add(this.holder);
    this.holder.add(this.glassGroup);
    // A soft light from over the viewer's shoulder, in the phone's frame:
    // the screen's own glow, so a glass at night is a shape and not a hole.
    this.fill.position.set(-1, 1.5, 4);
    this.phone.add(this.fill);
    this.fill.target = this.holder;
    this.glassGroup.add(this.glowLight);
    this.scene.add(this.phone);

    this.dome = createSkyDome(100);
    this.scene.add(this.dome.mesh);
    this.envDome = createSkyDome(100, MIRROR_SUN);
    this.envScene.add(this.envDome.mesh);

    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const c = this.key.shadow.camera;
    c.left = -0.8;
    c.right = 0.8;
    c.top = 0.8;
    c.bottom = -0.8;
    c.near = 0.1;
    c.far = 12;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.01;
    this.scene.add(this.key, this.key.target, this.hemi);
  }

  setSize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(Math.min(2, dpr));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Build the glass for a look: its frame, its glass and its sand. */
  setLook(look: Look, layout: Layout, source: Bulb, sink: Bulb): void {
    if (this.parts) {
      this.glassGroup.remove(this.parts);
      disposeGroup(this.parts);
    }
    for (const m of this.sandMaterials) m.dispose();
    this.sandMaterials = [];
    this.look = look;
    const parts = new THREE.Group();
    const heaps = new THREE.Group();
    parts.add(heaps);
    this.heaps = heaps;
    const glass = glassMaterial(look);
    this.frame = frameGroup(look, layout, glass);
    parts.add(this.frame);
    parts.add(glassMesh(layout, glass));
    const speckle = sandTextures(SAND[look.sand]);
    const textures = { ...speckle, bump: loadGrainBump() };
    // The skin's lathe runs its texture once round and once along; the
    // same speckle there, as fine as on the surface.
    const skinTextures = {
      map: speckle.map.clone(),
      rough: speckle.rough.clone(),
      bump: loadGrainBump().clone(),
    };
    for (const t of Object.values(skinTextures)) {
      t.repeat.set(GRAIN_REPEAT * 1.1, GRAIN_REPEAT * 0.4);
    }
    // The speckle's data is there at once; the photograph uploads when it
    // arrives, through the source the clone shares.
    skinTextures.map.needsUpdate = true;
    skinTextures.rough.needsUpdate = true;
    this.bulbs = [source, sink].map((bulb) => {
      const group = new THREE.Group();
      const count = surfaceVertexCount(bulb.n, bulb.m);
      const positions = new Float32Array(count * 3);
      const presence = new Float32Array(count);
      const uvs = new Float32Array(count * 2);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("presence", new THREE.BufferAttribute(presence, 1));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(
        new THREE.BufferAttribute(surfaceIndex(bulb.n, bulb.m), 1),
      );
      const surfaceMaterial = sandMaterial(look, textures, null);
      const surface = new THREE.Mesh(geometry, surfaceMaterial);
      surface.receiveShadow = true;
      surface.frustumCulled = false;
      // The skin: the wall, a hair inside the glass, cut where the heap
      // meets it.
      const H = bulb.shape.height;
      const wall: THREE.Vector2[] = [];
      for (let k = 0; k <= 64; k++) {
        const y = (H * k) / 64;
        wall.push(new THREE.Vector2(wallAt(bulb, y) * 0.985, y));
      }
      const rims = new Float32Array(bulb.m);
      const skinMaterial = sandMaterial(look, skinTextures, rims);
      const skin = new THREE.Mesh(
        new THREE.LatheGeometry(wall, 72),
        skinMaterial,
      );
      skin.receiveShadow = true;
      const air = this.grains(look, AIR_CAP);
      group.add(surface, skin, air);
      heaps.add(group);
      this.sandMaterials.push(surfaceMaterial, skinMaterial);
      return {
        group,
        surface,
        positions,
        presence,
        uvs,
        skin,
        rims,
        air,
      };
    });
    // The stream: a thread of sand, and grains falling down it.
    const streamMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SAND[look.sand].color),
      roughness: 1,
    });
    this.stream = new THREE.Mesh(new THREE.BufferGeometry(), streamMaterial);
    this.streamKey = "";
    this.stream.frustumCulled = false;
    this.streamGrains = this.grains(look, STREAM_GRAINS);
    this.streamGrains.count = STREAM_GRAINS;
    this.bulbs[1]!.group.add(this.stream, this.streamGrains);
    this.sandMaterials.push(streamMaterial);
    this.parts = parts;
    this.glassGroup.add(parts);
  }

  /** Grains, lit like the heap they come from: a small ball each, placed
   *  and sized a frame at a time. Points would be quicker, but a point is
   *  not lit — it glows the sand's own colour in any light, and a falling
   *  heap drawn with them shines at dusk and at night. */
  private grains(look: Look, count: number): THREE.InstancedMesh {
    const spec = SAND[look.sand];
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.color),
      roughness: 1,
      metalness: spec.sparkle ? 0.35 : 0,
      envMapIntensity: 0.45,
    });
    this.sandMaterials.push(material);
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      material,
      count,
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** The sky, into the dome, the lights and — when it has moved enough to
   *  show — the environment the glass reflects. */
  private setSky(sky: SkyLook, drift: number, seconds: number): void {
    this.dome.update(sky, drift, seconds);
    const key = sky.key;
    this.key.position.set(key.x * 5, key.y * 5, key.z * 5);
    this.key.color.setRGB(...sky.keyColour);
    this.key.intensity = sky.keyIntensity;
    // No shadow from a light under the horizon.
    this.key.castShadow = key.y > 0.02;
    this.hemi.color.setRGB(...sky.skyLight);
    this.hemi.groundColor.setRGB(
      sky.horizon[0] * 0.6,
      sky.horizon[1] * 0.6,
      sky.horizon[2] * 0.6,
    );
    this.hemi.intensity = sky.ambient;
    this.fill.intensity = 0.05 + 0.12 * (1 - sky.brightness);
    const envKey = [
      sky.sun.x.toFixed(2),
      sky.sun.y.toFixed(2),
      sky.sun.z.toFixed(2),
      sky.moon.y.toFixed(2),
      sky.brightness.toFixed(2),
    ].join();
    if (envKey !== this.envKey) {
      this.envKey = envKey;
      this.envDome.update(sky, drift, seconds);
      // Unblurred and fine, so the glass holds the sky as a mirror does —
      // the horizon, the clouds, the sun's glint — and a rougher surface
      // (the sand, the wood) reads the blurrier levels of the same map.
      const next = this.pmrem.fromScene(this.envScene, 0, 0.1, 200, {
        size: 512,
      });
      this.env?.dispose();
      this.env = next;
      this.scene.environment = next.texture;
    }
  }

  private turnPhone(orientation: number[] | null): void {
    // Device to Earth (east, north, up), then Earth to the sky's frame (x
    // east, y up, z south), then round to the heading the view faces.
    const r = orientation ?? UPRIGHT;
    const earth = new THREE.Matrix4().set(
      r[0]!,
      r[1]!,
      r[2]!,
      0,
      r[3]!,
      r[4]!,
      r[5]!,
      0,
      r[6]!,
      r[7]!,
      r[8]!,
      0,
      0,
      0,
      0,
      1,
    );
    const sky = new THREE.Matrix4().set(
      1,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      -1,
      0,
      0,
      0,
      0,
      0,
      1,
    );
    const heading = new THREE.Matrix4().makeRotationY(-VIEW_HEADING);
    this.basis.multiplyMatrices(heading, sky).multiply(earth);
    this.phone.quaternion.setFromRotationMatrix(this.basis);
  }

  render(frame: StageFrame): void {
    if (frame.look !== this.look) {
      this.setLook(frame.look, frame.layout, frame.source, frame.sink);
    }
    this.turnPhone(frame.orientation);
    this.setSky(frame.sky, frame.drift, frame.seconds);

    // The glass in the phone: the lag (z outermost), the tap's half turn
    // with it, then the finger's orbit about its own axis; sized to fill
    // its share of the view's height.
    const { view } = frame;
    this.holder.rotation.set(
      view.lag[0],
      view.lag[1],
      view.lag[2] + frame.flip,
      "ZYX",
    );
    this.glassGroup.rotation.set(0, view.orbit, 0);
    this.frame.rotation.z = frame.upended ? Math.PI : 0;
    const visible = 2 * DISTANCE * Math.tan(((FOV / 2) * Math.PI) / 180);
    const s = visible * frame.size;
    this.glassGroup.scale.set(s, s, s);

    // The heaps, in their own frames: the source rests on the waist, the
    // sink on the plate below it, and upside down both hang the other way.
    const B = frame.layout.bulb.height;
    const up = frame.gravity;
    const [src, snk] = this.bulbs;
    if (src && snk) {
      this.heaps.rotation.z = frame.turned ? Math.PI : 0;
      src.group.position.y = 0;
      src.group.scale.y = up;
      snk.group.position.y = -up * B;
      snk.group.scale.y = up;
      this.drawBulb(src, frame.source);
      this.drawBulb(snk, frame.sink);
      this.drawStream(frame);
    }
    this.glowLight.intensity = frame.glow * 0.8;

    this.phone.updateMatrixWorld(true);
    const eye = new THREE.Vector3();
    this.camera.getWorldPosition(eye);
    this.dome.mesh.position.copy(eye);
    this.renderer.render(this.scene, this.camera);
  }

  private drawBulb(view: BulbView, bulb: Bulb): void {
    surfaceInto(bulb, view.positions, view.presence);
    const count = view.presence.length;
    for (let k = 0; k < count; k++) {
      view.uvs[k * 2] = view.positions[k * 3]! * GRAIN_REPEAT;
      view.uvs[k * 2 + 1] = view.positions[k * 3 + 2]! * GRAIN_REPEAT;
    }
    const g = view.surface.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.presence!.needsUpdate = true;
    g.attributes.uv!.needsUpdate = true;
    g.computeVertexNormals();
    rimHeights(bulb, view.rims);
    const air = bulb.air;
    const m = view.air.instanceMatrix.array as Float32Array;
    for (let k = 0; k < air.count; k++) {
      const r = Math.max(
        GRAIN_MIN,
        Math.cbrt((3 * air.vol[k]!) / (4 * Math.PI)),
      );
      place(m, k, air.x[k]!, air.y[k]!, air.z[k]!, r);
    }
    view.air.count = air.count;
    view.air.instanceMatrix.needsUpdate = true;
    view.air.visible = air.count > 0 && airborne(bulb) > 0;
  }

  /** The stream, in the sink's frame, along the path it takes
   *  (`streamPath`): out of the bore, down through the air, and — when the
   *  glass leans — onto the glass and down the inside of it to the heap. A
   *  tube along the path, rebuilt when the path moves, and grains running
   *  down it: falling faster and faster through the air, sliding at an
   *  even pace down the glass. */
  private drawStream(frame: StageFrame): void {
    const stream = this.stream;
    const grains = this.streamGrains;
    if (!stream || !grains) return;
    const on = frame.flow > 0;
    stream.visible = on;
    grains.visible = on;
    if (!on) return;
    const path = frame.stream ?? streamPath(frame.sink);
    if (path.count < 2) return;
    const r = frame.layout.bulb.bore * 1.1;
    const key = pathKey(path);
    if (key !== this.streamKey) {
      this.streamKey = key;
      const points: THREE.Vector3[] = [];
      // A point every few steps is plenty for the curve through them.
      const every = Math.max(1, Math.floor(path.count / 48));
      for (let k = 0; k < path.count; k += every) {
        points.push(
          new THREE.Vector3(
            path.points[k * 3]!,
            path.points[k * 3 + 1]!,
            path.points[k * 3 + 2]!,
          ),
        );
      }
      const last = path.count - 1;
      points.push(
        new THREE.Vector3(
          path.points[last * 3]!,
          path.points[last * 3 + 1]!,
          path.points[last * 3 + 2]!,
        ),
      );
      if (points.length < 2) points.push(points[0]!.clone());
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      stream.geometry.dispose();
      stream.geometry = new THREE.TubeGeometry(
        curve,
        Math.min(96, Math.max(8, points.length * 2)),
        r,
        8,
        false,
      );
    }
    // The grains down it, each where the traced motion has a grain at its
    // own moment of the trip: quickening through the air, sliding at the
    // pace friction allows on the glass.
    const { points, times, count } = path;
    const m = grains.instanceMatrix.array as Float32Array;
    const size = frame.layout.bulb.bore * STREAM_GRAIN;
    const trip = Math.max(1e-3, times[count - 1]!);
    let j = 0;
    const order = Array.from({ length: STREAM_GRAINS }, (_, k) => {
      const phase = (k * 0.618034) % 1;
      return { k, at: ((frame.seconds / trip + phase) % 1) * trip };
    }).sort((p, q) => p.at - q.at);
    for (const { k, at } of order) {
      while (j < count - 2 && times[j + 1]! < at) j++;
      const t0 = times[j]!;
      const t1 = times[j + 1] ?? t0;
      const u = t1 > t0 ? Math.min(1, (at - t0) / (t1 - t0)) : 0;
      const x = points[j * 3]! + (points[(j + 1) * 3]! - points[j * 3]!) * u;
      const y =
        points[j * 3 + 1]! +
        (points[(j + 1) * 3 + 1]! - points[j * 3 + 1]!) * u;
      const z =
        points[j * 3 + 2]! +
        (points[(j + 1) * 3 + 2]! - points[j * 3 + 2]!) * u;
      // In the air a falling stream spreads a little; on the glass it
      // is a rivulet pressed to the wall.
      const spread = j < path.wall ? r * (1 + 2 * (at / trip)) : r * 0.6;
      place(
        m,
        k,
        x + Math.sin(k * 12.9898 + frame.seconds * 3) * 0.5 * spread,
        y,
        z + Math.cos(k * 78.233 + frame.seconds * 2) * 0.5 * spread,
        size,
      );
    }
    grains.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.parts) disposeGroup(this.parts);
    for (const m of this.sandMaterials) m.dispose();
    this.dome.dispose();
    this.envDome.dispose();
    this.env?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}

/** Instance `k` of a grain mesh as a ball of radius `r` at (x, y, z),
 *  written straight into its matrix (column-major). */
function place(
  m: Float32Array,
  k: number,
  x: number,
  y: number,
  z: number,
  r: number,
): void {
  const o = k * 16;
  m.fill(0, o, o + 16);
  m[o] = r;
  m[o + 5] = r;
  m[o + 10] = r;
  m[o + 12] = x;
  m[o + 13] = y;
  m[o + 14] = z;
  m[o + 15] = 1;
}

/** A path's shape, coarsely: the tube is rebuilt only when it moves by
 *  more than a hair. */
function pathKey(path: StreamPath): string {
  const q = (v: number) => Math.round(v * 400);
  const last = path.count - 1;
  const mid = Math.floor(path.wall);
  const at = (k: number) =>
    `${q(path.points[k * 3]!)},${q(path.points[k * 3 + 1]!)},${q(path.points[k * 3 + 2]!)}`;
  return `${path.count}|${at(Math.min(mid, last))}|${at(last)}`;
}

/** An upright phone facing the default heading, as a device-to-Earth
 *  rotation (`deviceToEarth(0, 90, 0)`). */
const UPRIGHT = [1, 0, 0, 0, 0, -1, 0, 1, 0];

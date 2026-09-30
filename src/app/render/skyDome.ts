// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as THREE from "three";

import type { SkyLook } from "../sky.ts";

// THE DOME — a sphere round the lens painted with the sky's colour
// (`sky.ts`), and over it the sun's disc, the moon's (lit on its sun side as
// far as its phase says), the stars and a faint band of the Milky Way, and
// a layer of fair-weather cloud. The design is the sibling game4's dome
// (its `sky-dome.ts` and `haze.ts`), cut to a glass's needs.
//
// THE CLOUD IS A PLANE, not a volume: a direction is carried up to a layer
// a fixed height over the lens and the layer's noise read where it lands,
// so a heap near the horizon is foreshortened into the band it is in a
// real sky, and it drifts — `drift` is how far, in the layer's heights.
//
// It goes through the same tone mapping and output conversion as every lit
// surface, so the glass's reflections of it (the environment map rendered
// off this same dome) meet it without a seam.

/** The sun's apparent radius, rad — a touch over the real quarter degree
 *  so the disc is more than a few pixels on a phone. */
const SUN_RADIUS = 0.009;
/** The moon's, a little larger again. */
const MOON_RADIUS = 0.014;

export type SkyDome = {
  mesh: THREE.Mesh;
  update(look: SkyLook, drift: number, seconds: number): void;
  dispose(): void;
};

const f = (x: number) => x.toFixed(5);

/** How a dome draws its sun: the one on screen is the true small disc; the
 *  one rendered into the environment the glass reflects is drawn larger and
 *  less fierce, so the reflection keeps a sharp glint of the sun rather than
 *  losing a few texels of it to the filtering. */
export type SunDisc = { radius: number; gain: number };

export const SCREEN_SUN: SunDisc = { radius: SUN_RADIUS, gain: 40 };
export const MIRROR_SUN: SunDisc = { radius: 0.05, gain: 45 };

export function createSkyDome(
  radius: number,
  sun: SunDisc = SCREEN_SUN,
): SkyDome {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uMoonLit: { value: 0 },
    uNight: { value: 0 },
    uStars: { value: 0 },
    uCover: { value: 0 },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uDrift: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uSunCos: { value: Math.cos(sun.radius) },
    uSunGain: { value: sun.gain },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Pinned to the far plane, so nothing is ever clipped by the sky.
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uSunCol;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform float uMoonLit;
      uniform float uNight;
      uniform float uStars;
      uniform float uCover;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudShade;
      uniform vec2 uDrift;
      uniform float uTime;
      uniform float uSunCos;
      uniform float uSunGain;
      varying vec3 vDir;

      vec3 skyColour(vec3 dir) {
        float up = clamp(dir.y, 0.0, 1.0);
        vec3 c = mix(uHorizon, uZenith, pow(up, 0.5));
        float mu = max(dot(dir, uSunDir), 0.0);
        // The aureole round the sun, strongest low on the dome.
        c += uGlow * (0.22 * pow(mu, 6.0) + 0.5 * pow(mu, 48.0)) * (1.0 - 0.6 * up);
        // Under the horizon: the land, in the haze's colour, a little darker
        // the further down — gently, over thirty degrees. The glass mirrors
        // it (the waist's downward-facing walls most of all, and a tight
        // curve squeezes a wide sweep of it into a sliver), so a dark land
        // with a hard edge under the horizon became black blades there that
        // flickered with every move of the phone.
        if (dir.y < 0.0) c = mix(c, uHorizon * 0.72, smoothstep(0.0, 0.5, -dir.y));
        return c;
      }

      float dh(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }
      float dn(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(dh(i), dh(i + vec2(1, 0)), u.x), mix(dh(i + vec2(0, 1)), dh(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += a * dn(p);
          p = p * 2.03 + vec2(17.3, 9.1);
          a *= 0.5;
        }
        return s;
      }
      float h13(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
      }

      // The stars: a few on a grid of directions, each a point sized in
      // pixels off the ray's own derivative, so every screen gets the same
      // sky; two layers, the bright few and the many faint.
      vec3 stars(vec3 d) {
        vec3 c = vec3(0.0);
        float px = length(fwidth(d));
        for (int l = 0; l < 2; l++) {
          float scale = l == 0 ? 60.0 : 150.0;
          float thr = l == 0 ? 0.93 : 0.9;
          vec3 p = d * scale;
          vec3 id = floor(p);
          float h = h13(id);
          if (h > thr) {
            vec3 off = vec3(h13(id + 1.7), h13(id + 3.1), h13(id + 5.3)) - 0.5;
            vec3 sp = normalize(id + 0.5 + off * 0.8);
            float dist = length(d - sp) * scale;
            float r = max(1.2 * px * scale, 0.02);
            float mag = pow((h - thr) / (1.0 - thr), 2.0) * (l == 0 ? 2.2 : 0.8);
            float twinkle = 0.75 + 0.25 * sin(uTime * (2.0 + 5.0 * h) + h * 40.0);
            vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), h13(id + 9.1));
            c += tint * mag * twinkle * smoothstep(r, 0.0, dist);
          }
        }
        // The Milky Way: a mottled band on a great circle.
        vec3 n = normalize(vec3(0.35, 0.55, 0.76));
        float band = exp(-pow(dot(d, n), 2.0) * 28.0);
        vec2 q = vec2(atan(d.z, d.x), d.y) * 3.0;
        c += vec3(0.55, 0.6, 0.75) * band * (0.35 + 0.65 * fbm(q * 2.0)) * 0.05;
        return c;
      }

      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColour(d);
        float up = max(d.y, 0.0);

        // THE CLOUD: fair-weather heaps, flat-based, bright on their sunward
        // side, foreshortened toward the horizon.
        float hide = 0.0;
        vec3 cloud = vec3(0.0);
        if (uCover > 0.0 && d.y > -0.02) {
          vec2 p = d.xz / (up + 0.06) * 0.6 + uDrift;
          float fade = smoothstep(0.0, 0.12, up);
          float n = fbm(p * 1.3);
          float cov = smoothstep(1.0 - uCover - 0.02, 1.0 - uCover + 0.22, n);
          vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.08;
          float lit = clamp((n - fbm((p + toSun) * 1.3)) * 6.0 + 0.5, 0.0, 1.0);
          cloud = mix(uCloudShade, uCloudLit, lit);
          hide = cov * fade;
        }
        float clearSky = 1.0 - hide;

        // THE NIGHT SKY, behind everything, washed out round the moon.
        if (uStars > 0.001 && d.y > -0.05) {
          float toMoon = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
          float glare = exp(-toMoon * toMoon * 7.0) * uMoonLit * step(-0.02, uMoonDir.y);
          c += stars(d) * uStars * (1.0 - glare) * clearSky * smoothstep(-0.05, 0.08, d.y);
        }

        // THE SUN'S DISC.
        float mu = dot(d, uSunDir);
        float edge = (1.0 - uSunCos) * 0.08;
        float disc = smoothstep(uSunCos - edge, uSunCos + edge * 0.3, mu);
        c += uSunCol * disc * uSunGain * (1.0 - hide * 0.97) * step(-0.02, uSunDir.y);

        // THE MOON: a disc lit on the sun's side as far as its phase says,
        // a faint halo round it, behind the cloud.
        float mm = dot(d, uMoonDir);
        float mr = cos(${f(MOON_RADIUS)});
        if (mm > mr - 0.0005 && uMoonDir.y > -0.02) {
          vec3 o = d - uMoonDir * mm;
          vec3 sunSide = uSunDir - uMoonDir * dot(uSunDir, uMoonDir);
          float side = dot(o, normalize(sunSide + 1e-5)) / ${f(MOON_RADIUS)};
          float lit = smoothstep(-0.08, 0.08, side + (2.0 * uMoonLit - 1.0));
          float edge = smoothstep(mr - 0.00004, mr + 0.00002, mm);
          // A little of the moon's own mottle.
          float mare = 0.8 + 0.2 * fbm(o.xy * 900.0);
          c += vec3(0.95, 0.96, 1.0) * edge * (0.03 + 2.2 * lit * mare) * mix(0.35, 1.0, uNight) * (1.0 - hide * 0.9);
        }
        c += vec3(0.5, 0.6, 0.8) * pow(max(mm, 0.0), 900.0) * 0.15 * uMoonLit * uNight * clearSky;

        c = mix(c, cloud, hide);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    update(look, drift, seconds) {
      uniforms.uZenith.value.setRGB(...look.zenith);
      uniforms.uHorizon.value.setRGB(...look.horizon);
      uniforms.uGlow.value.setRGB(...look.glow);
      uniforms.uSunCol.value.setRGB(...look.sunColour);
      uniforms.uSunDir.value.set(look.sun.x, look.sun.y, look.sun.z);
      uniforms.uMoonDir.value.set(look.moon.x, look.moon.y, look.moon.z);
      uniforms.uMoonLit.value = look.moonLit;
      uniforms.uNight.value = look.night;
      uniforms.uStars.value = look.stars;
      uniforms.uCover.value = look.cover;
      uniforms.uCloudLit.value.setRGB(...look.cloudLit);
      uniforms.uCloudShade.value.setRGB(...look.cloudShade);
      uniforms.uDrift.value.set(drift, drift * 0.35);
      // Wrapped, so a float counting all night keeps a twinkle's precision.
      uniforms.uTime.value = seconds % 3600;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

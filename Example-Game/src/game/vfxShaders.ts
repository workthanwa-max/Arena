import * as THREE from 'three'

/**
 * Modular Anti-Neon Cel-Anime GLSL Shader Library for ArenaVV 3D Skill VFX (Three.js r187 / WebGL2).
 * Follows awesome-gamedev-agent-skills (`shader-programming` + `threejs-materials-lighting`):
 * - No uniform initializers in GLSL ES
 * - Branchless smoothstep/mix math on per-pixel fragment paths
 * - Anti-Neon discipline: toneMapped: true, no +vec3(0.5) white blowout, dark contrast rims,
 *   NormalBlending for solid/physical/dark silhouettes, controlled low-opacity AdditiveBlending for highlights only.
 */

const COMMON_GLSL_NOISE = /* glsl */ `
float vfxHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vfxNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = vfxHash(i);
  float b = vfxHash(i + vec2(1.0, 0.0));
  float c = vfxHash(i + vec2(0.0, 1.0));
  float d = vfxHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float vfxFbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += amp * vfxNoise(p);
    p *= 2.05;
    amp *= 0.5;
  }
  return v;
}
`

const SHARED_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;

void main() {
  vUv = uv;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mvPos.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPos;
}
`

// 1. Structured Anime Energy Beam (crisp core + helical flow veins + controlled rim, no neon blowout)
const STRUCTURED_BEAM_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
${COMMON_GLSL_NOISE}

void main() {
  vec3 viewDir = normalize(vViewPos);
  float ndotv = abs(dot(normalize(vNormalView), viewDir));
  float fresnel = pow(1.0 - ndotv, 1.8);
  float scroll = uTime * uSpeed;

  // Directional helical flow bands along beam axis (vUv.y)
  float spiral = sin((vUv.x * 6.28318 * 2.0) + (vUv.y * 14.0) - scroll * 7.5) * 0.5 + 0.5;
  float n1 = vfxFbm(vec2(vUv.x * 5.0 + scroll * 0.35, vUv.y * 8.0 - scroll * 3.2));
  float streak = smoothstep(0.32, 0.82, n1 * 0.65 + spiral * 0.35);

  // Clean tapered ends
  float endFade = smoothstep(0.0, 0.07, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  // Crisp 3-step anime cel core (darkened rim -> outer color -> crisp inner core)
  float coreMask = smoothstep(0.52, 0.78, ndotv);
  float rimDark = smoothstep(0.12, 0.36, ndotv);

  vec3 baseCol = mix(uOuterColor * 0.45, uOuterColor, rimDark);
  vec3 col = mix(baseCol, uCoreColor, clamp(coreMask * 0.82 + streak * 0.22, 0.0, 1.0));
  float alpha = clamp((0.42 + streak * 0.38 + coreMask * 0.28 - fresnel * 0.12) * endFade * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 2. Crisp Cel-Shaded 3D Melee Slash Ribbon (sweeps across u: 0->1 with UV erosion & dark ink rim)
const CEL_SLASH_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uProgress;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
${COMMON_GLSL_NOISE}

void main() {
  // Progressive anime wipe-in then tail dissolve across arc length (vUv.x)
  float headEdge = clamp(uProgress * 2.4 + 0.25, 0.25, 1.15);
  float tailEdge = clamp((uProgress - 0.18) * 1.45, 0.0, 1.0);
  float sweepMask = smoothstep(tailEdge - 0.14, tailEdge + 0.08, vUv.x) * (1.0 - smoothstep(headEdge - 0.12, headEdge, vUv.x));
  float tipTaper = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.84, vUv.x);

  float n = vfxFbm(vec2(vUv.x * 8.0 - uTime * 3.2, vUv.y * 5.0));
  float dissolve = smoothstep(uProgress * 0.72, uProgress * 0.72 + 0.18, n + vUv.y * 0.58);

  // 3-step anime blade bands: dark ink trailing edge -> rich outer hue -> razor-bright cutting edge
  float bodyBand = smoothstep(0.20, 0.34, vUv.y);
  float hotEdge = smoothstep(0.74, 0.88, vUv.y + (n - 0.5) * 0.14);

  vec3 inkCol = uOuterColor * 0.2;
  vec3 col = mix(inkCol, uOuterColor, bodyBand);
  col = mix(col, uCoreColor, hotEdge);

  float alpha = clamp(sweepMask * tipTaper * dissolve * smoothstep(0.06, 0.2, vUv.y) * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 3. True Crackling Lightning Filament (sharp high-contrast electric core + subtle aura)
const LIGHTNING_ARC_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
${COMMON_GLSL_NOISE}

void main() {
  vec3 viewDir = normalize(vViewPos);
  float ndotv = abs(dot(normalize(vNormalView), viewDir));
  float flicker = 0.78 + 0.22 * step(0.35, vfxHash(vec2(floor(uTime * 28.0), floor(vUv.y * 6.0))));
  float core = smoothstep(0.35, 0.72, ndotv);

  vec3 col = mix(uOuterColor, uCoreColor, core);
  float alpha = clamp((0.55 + core * 0.45) * flicker * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 4. Anti-Neon Hero Ground Sigil / Domain Ring (clean geometric border + subtle fill, no blinding glow)
const CEL_ZONE_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
${COMMON_GLSL_NOISE}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);

  float outerBorder = smoothstep(0.89, 0.94, dist) * smoothstep(1.0, 0.96, dist);
  float darkRim = smoothstep(0.84, 0.89, dist) * smoothstep(0.95, 0.91, dist);
  float innerRing = smoothstep(0.54, 0.565, dist) * smoothstep(0.59, 0.57, dist);
  float runeTicks = smoothstep(0.45, 0.78, sin(angle * 12.0 + uTime * uSpeed * 0.9));
  float subtleFill = smoothstep(0.96, 0.15, dist) * 0.18;

  vec3 viewDir = normalize(vViewPos);
  float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), viewDir)), 2.6);

  float insideMask = smoothstep(1.0, 0.95, dist);
  float lineMask = clamp(outerBorder * 0.95 + innerRing * (0.4 + runeTicks * 0.4) + fresnel * 0.28, 0.0, 1.0);

  vec3 col = mix(uOuterColor * 0.55, uOuterColor, clamp(lineMask + 0.25, 0.0, 1.0));
  col = mix(col, uCoreColor, clamp(outerBorder * 0.75 + runeTicks * innerRing * 0.6, 0.0, 1.0));
  col = mix(col, uOuterColor * 0.18, darkRim * 0.55);

  float alpha = clamp((subtleFill + lineMask * 0.78 + darkRim * 0.35) * insideMask * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 5. Dark Void / Abyssal Core (Aizen Kurohitsugi, Yami Black Moon, Itachi Amaterasu, Meliodas, Jinwoo)
const DARK_VOID_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
${COMMON_GLSL_NOISE}

void main() {
  vec3 viewDir = normalize(vViewPos);
  float ndotv = abs(dot(normalize(vNormalView), viewDir));
  float fresnel = pow(1.0 - ndotv, 2.1);

  float t = uTime * uSpeed;
  float n = vfxFbm(vec2(vUv.x * 5.0 + t * 0.6, vUv.y * 5.0 - t * 0.9));
  float rimMask = smoothstep(0.32, 0.82, fresnel + (n - 0.5) * 0.22);

  // Deep obsidian interior with crisp colored edge
  vec3 darkBase = mix(vec3(0.03, 0.02, 0.06), uOuterColor * 0.28, n * 0.65);
  vec3 col = mix(darkBase, uCoreColor, rimMask * 0.85);
  float alpha = clamp((0.76 + rimMask * 0.24) * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 6. Physical Air-Pressure Shock Cone (punches, kicks, wind blasts — crisp dust/pressure rings, zero neon)
const SHOCK_CONE_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
${COMMON_GLSL_NOISE}

void main() {
  float scroll = uTime * uSpeed;
  float n = vfxNoise(vec2(vUv.x * 10.0, vUv.y * 5.0 - scroll * 3.0));
  float bands = smoothstep(0.35, 0.82, sin(vUv.y * 16.0 - scroll * 8.0) * 0.5 + 0.5 + (n - 0.5) * 0.35);
  float fade = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.72, vUv.y);

  vec3 col = mix(uOuterColor * 0.7, uCoreColor, bands * 0.75);
  float alpha = clamp((0.28 + bands * 0.52) * fade * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 7. Restrained Plasma / Energy Orb (anti-neon, stepped contrast core)
const PLASMA_ORB_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
${COMMON_GLSL_NOISE}

void main() {
  vec3 viewDir = normalize(vViewPos);
  float ndotv = abs(dot(normalize(vNormalView), viewDir));
  float fresnel = pow(1.0 - ndotv, 2.2);

  float t = uTime * uSpeed;
  float n = vfxFbm(vec2(vUv.x * 5.0 + t * 0.8, vUv.y * 5.0 - t * 1.1));
  float hot = smoothstep(0.38, 0.86, ndotv * 0.72 + n * 0.35);

  vec3 col = mix(uOuterColor * 0.72, uCoreColor, hot);
  col = mix(col, uOuterColor, fresnel * 0.45);
  float alpha = clamp((0.72 + fresnel * 0.22) * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 8. Expanding Ground Shockwave Ring (crisp impact ring without white blowout)
const SHOCKWAVE_RING_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uProgress;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
${COMMON_GLSL_NOISE}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);

  float radius = mix(0.20, 0.94, uProgress);
  float thickness = mix(0.16, 0.055, uProgress);
  float band = 1.0 - smoothstep(0.0, thickness, abs(dist - radius));

  float n = vfxNoise(vec2(angle * 5.0 + uTime * 1.5, dist * 8.0 - uTime * 3.0));
  float jagged = smoothstep(0.22, 0.82, band + (n - 0.5) * 0.26);

  vec3 col = mix(uOuterColor, uCoreColor, smoothstep(0.55, 0.95, band));
  float fadeOut = 1.0 - smoothstep(0.58, 1.0, uProgress);
  float alpha = clamp(jagged * fadeOut * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 9. Sculpted 3D Swirling Vortex / Tornado Shader (scrolling helical wind/shadow/water ribbons)
const VORTEX_SWIRL_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
${COMMON_GLSL_NOISE}

void main() {
  float t = uTime * uSpeed;
  float twistU = fract(vUv.x * 3.0 + vUv.y * 1.8 - t * 1.4);
  float n = vfxFbm(vec2(twistU * 6.0, vUv.y * 5.0 - t * 2.2));
  float ribbon = smoothstep(0.32, 0.78, sin((vUv.x * 6.28318 * 3.0) + (vUv.y * 9.0) - t * 6.0) * 0.5 + 0.5 + (n - 0.5) * 0.45);
  float vertFade = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.72, vUv.y);

  vec3 col = mix(uOuterColor * 0.48, uOuterColor, ribbon);
  col = mix(col, uCoreColor, smoothstep(0.68, 0.94, ribbon));
  float alpha = clamp((0.22 + ribbon * 0.72) * vertFade * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

// 10. Sculpted 3D Cel-Shaded Anime Flame Shader (rising 3-tone flame erosion, works for fire & black flames!)
const ANIME_FLAME_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform vec3 uCoreColor;
uniform vec3 uOuterColor;
varying vec2 vUv;
${COMMON_GLSL_NOISE}

void main() {
  float t = uTime * uSpeed;
  float n = vfxFbm(vec2(vUv.x * 5.0, vUv.y * 4.5 - t * 3.2));
  float flameMask = smoothstep(vUv.y * 0.85, vUv.y * 0.85 + 0.24, n + 0.34);
  float coreBand = smoothstep(0.28, 0.75, (1.0 - vUv.y) * 0.72 + n * 0.42);
  float baseFade = smoothstep(0.0, 0.1, vUv.y);

  vec3 col = mix(uOuterColor, uCoreColor, step(0.48, coreBand));
  float alpha = clamp(flameMask * baseFade * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`

export type VfxShaderKind =
  | 'beam'
  | 'structuredBeam'
  | 'slash'
  | 'celSlash'
  | 'lightningArc'
  | 'domain'
  | 'celZone'
  | 'darkVoid'
  | 'shockCone'
  | 'plasma'
  | 'shockwave'
  | 'vortexSwirl'
  | 'animeFlame'

export class VfxShaderLibrary {
  private tracked = new Set<THREE.ShaderMaterial>()
  private time = 0

  createMaterial(
    kind: VfxShaderKind,
    coreHex: number,
    outerHex: number,
    opts?: { opacity?: number; speed?: number; side?: THREE.Side; additive?: boolean },
  ): THREE.ShaderMaterial {
    let frag = PLASMA_ORB_FRAG
    let defaultAdditive = false

    switch (kind) {
      case 'beam':
      case 'structuredBeam':
        frag = STRUCTURED_BEAM_FRAG
        defaultAdditive = false
        break
      case 'slash':
      case 'celSlash':
        frag = CEL_SLASH_FRAG
        defaultAdditive = false
        break
      case 'lightningArc':
        frag = LIGHTNING_ARC_FRAG
        defaultAdditive = true
        break
      case 'domain':
      case 'celZone':
        frag = CEL_ZONE_FRAG
        defaultAdditive = false
        break
      case 'darkVoid':
        frag = DARK_VOID_FRAG
        defaultAdditive = false
        break
      case 'shockCone':
        frag = SHOCK_CONE_FRAG
        defaultAdditive = false
        break
      case 'shockwave':
        frag = SHOCKWAVE_RING_FRAG
        defaultAdditive = false
        break
      case 'vortexSwirl':
        frag = VORTEX_SWIRL_FRAG
        defaultAdditive = false
        break
      case 'animeFlame':
        frag = ANIME_FLAME_FRAG
        defaultAdditive = false
        break
      default:
        frag = PLASMA_ORB_FRAG
        defaultAdditive = false
        break
    }

    const useAdditive = opts?.additive ?? defaultAdditive
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHARED_VERT,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: this.time },
        uOpacity: { value: opts?.opacity ?? (useAdditive ? 0.62 : 0.86) },
        uSpeed: { value: opts?.speed ?? 1.4 },
        uProgress: { value: 0.0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
      },
      transparent: true,
      depthWrite: false,
      blending: useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: opts?.side ?? THREE.DoubleSide,
      toneMapped: true,
    })

    this.tracked.add(mat)
    return mat
  }

  releaseMaterial(mat: THREE.ShaderMaterial): void {
    this.tracked.delete(mat)
    mat.dispose()
  }

  update(dt: number): void {
    this.time += dt
    for (const mat of this.tracked) {
      mat.uniforms.uTime.value = this.time
    }
  }

  dispose(): void {
    for (const mat of this.tracked) {
      mat.dispose()
    }
    this.tracked.clear()
  }
}

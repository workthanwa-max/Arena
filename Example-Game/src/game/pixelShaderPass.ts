import * as THREE from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

export interface PixelShaderOptions {
  depthEdgeStrength?: number
  ditherStrength?: number
  colorSteps?: number
  quantBlend?: number
}

/**
 * Single-pass GPU 3D Pixel Art post-processing pipeline:
 * - Renders the 3D scene once into a low-res NearestFilter WebGLRenderTarget (~65-90% fillrate savings)
 *   so the server/game loop has 0 overhead and the client GPU handles all pixel stylization locally.
 * - Supports both Retro Classic Pixel (3px, 28 steps) and Hi-Bit Fine Pixel (1.75px, 48 steps).
 * - Draws depth-silhouette pixel outlines on solid 3D meshes while leaving transparent VFX quads artifact-free.
 */
export class PixelArtGpuPass {
  private target: THREE.WebGLRenderTarget
  private material: THREE.ShaderMaterial
  private quad: FullScreenQuad
  private rtW = 0
  private rtH = 0
  private lastPixelSize = 0
  private lastCssW = 0
  private lastCssH = 0

  constructor(renderer: THREE.WebGLRenderer) {
    const depthTex = new THREE.DepthTexture(1, 1)
    depthTex.minFilter = THREE.NearestFilter
    depthTex.magFilter = THREE.NearestFilter

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: 0,
      depthBuffer: true,
      depthTexture: depthTex,
    })
    this.target.texture.generateMipmaps = false

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        resolution: { value: new THREE.Vector4(320, 180, 1 / 320, 1 / 180) },
        cameraNear: { value: 20 },
        cameraFar: { value: 7200 },
        depthEdgeStrength: { value: 0.42 },
        ditherStrength: { value: 0.032 },
        colorSteps: { value: 28 },
        quantBlend: { value: 0.55 },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec4 resolution;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float depthEdgeStrength;
        uniform float ditherStrength;
        uniform float colorSteps;
        uniform float quantBlend;
        varying vec2 vUv;

        float readViewZ(vec2 uv) {
          vec2 clamped = clamp(uv, resolution.zw * 0.5, 1.0 - resolution.zw * 0.5);
          float fragCoordZ = texture2D(tDepth, clamped).x;
          return -perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
        }

        float bayer2(vec2 a) {
          vec2 u = mod(floor(a), 2.0);
          return fract(u.x * 0.5 + u.y * 0.75);
        }

        float bayer4(vec2 p) {
          return 0.25 * bayer2(floor(mod(p, 4.0) * 0.5)) + bayer2(p);
        }

        void main() {
          vec2 pxCoord = floor(vUv * resolution.xy);
          vec2 pxUv = (pxCoord + 0.5) * resolution.zw;
          vec4 texel = texture2D(tDiffuse, pxUv);

          // Silhouette depth edge detection on solid geometry against far-behind background
          float zC = readViewZ(pxUv);
          float zR = readViewZ(pxUv + vec2(resolution.z, 0.0));
          float zL = readViewZ(pxUv - vec2(resolution.z, 0.0));
          float zU = readViewZ(pxUv + vec2(0.0, resolution.w));
          float zD = readViewZ(pxUv - vec2(0.0, resolution.w));

          float maxStep = max(
            max(max(0.0, zR - zC), max(0.0, zL - zC)),
            max(max(0.0, zU - zC), max(0.0, zD - zC))
          );
          float relThreshold = max(24.0, zC * 0.055);
          float outline = smoothstep(relThreshold, relThreshold * 1.85, maxStep);

          // Perceptual sRGB Bayer 4x4 dithering & configurable tonal steps; preserve HDR spell glows > 1.0
          vec3 hdrExcess = max(texel.rgb - vec3(1.0), vec3(0.0));
          vec3 srgb = pow(clamp(texel.rgb, 0.0, 1.0), vec3(1.0 / 2.2));
          float dither = (bayer4(pxCoord) - 0.46875) * ditherStrength;
          vec3 quantized = floor(clamp(srgb + dither, 0.0, 1.0) * colorSteps + 0.5) / colorSteps;
          vec3 crispSrgb = mix(srgb, quantized, quantBlend);
          vec3 lin = pow(crispSrgb, vec3(2.2)) + hdrExcess;

          lin *= (1.0 - depthEdgeStrength * outline);

          gl_FragColor = vec4(lin, texel.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })

    this.quad = new FullScreenQuad(this.material)
  }

  /** Synchronizes the virtual pixel render target resolution without unnecessary reallocations. */
  public syncResolution(cssWidth: number, cssHeight: number, pixelSize: number): void {
    const safePx = Math.max(1.25, pixelSize)
    if (
      cssWidth === this.lastCssW &&
      cssHeight === this.lastCssH &&
      safePx === this.lastPixelSize
    ) {
      return
    }
    this.lastCssW = cssWidth
    this.lastCssH = cssHeight
    this.lastPixelSize = safePx

    const nextW = Math.max(160, Math.floor(cssWidth / safePx))
    const nextH = Math.max(90, Math.floor(cssHeight / safePx))
    if (nextW !== this.rtW || nextH !== this.rtH) {
      this.rtW = nextW
      this.rtH = nextH
      this.target.setSize(nextW, nextH)
      this.material.uniforms.resolution.value.set(nextW, nextH, 1 / nextW, 1 / nextH)
    }
  }

  /** Renders the 3D scene through the low-res pixel shader pipeline onto the active screen buffer. */
  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    cssWidth: number,
    cssHeight: number,
    pixelSize: number,
    options?: PixelShaderOptions,
  ): void {
    this.syncResolution(cssWidth, cssHeight, pixelSize)
    this.material.uniforms.tDiffuse.value = this.target.texture
    this.material.uniforms.tDepth.value = this.target.depthTexture
    this.material.uniforms.cameraNear.value = camera.near
    this.material.uniforms.cameraFar.value = camera.far
    this.material.uniforms.depthEdgeStrength.value = options?.depthEdgeStrength ?? 0.42
    this.material.uniforms.ditherStrength.value = options?.ditherStrength ?? 0.032
    this.material.uniforms.colorSteps.value = options?.colorSteps ?? 28
    this.material.uniforms.quantBlend.value = options?.quantBlend ?? 0.55

    renderer.setRenderTarget(this.target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    this.quad.render(renderer)
  }

  /** Disposes GPU render targets, depth textures, and post-processing shader materials. */
  public dispose(): void {
    this.quad.dispose()
    this.material.dispose()
    this.target.depthTexture?.dispose()
    this.target.dispose()
  }
}

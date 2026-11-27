import * as THREE from 'three'
import type { GraphicsQuality } from '../types/game'

/**
 * GPU-Instanced 3D VFX Particle Pool (`performance-optimization` skill):
 * - 4 THREE.InstancedMesh pools (Sparks, Shards, Orbs, Rings) = ONLY 4 draw calls for 600+ live particles
 * - Zero per-frame heap allocations (pre-allocated TypedArrays + reusable Object3D/Color/Vector3)
 * - Scales budget automatically by GraphicsQuality so mobile & iPad hold 60 FPS cleanly
 */

export type InstancedParticleKind = 'spark' | 'shard' | 'orb' | 'ring'

interface PoolBucket {
  kind: InstancedParticleKind
  capacity: number
  cursor: number
  mesh: THREE.InstancedMesh
  active: Uint8Array
  px: Float32Array
  py: Float32Array
  pz: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  gravity: Float32Array
  drag: Float32Array
  life: Float32Array
  maxLife: Float32Array
  baseScale: Float32Array
  endScale: Float32Array
  rx: Float32Array
  ry: Float32Array
  rz: Float32Array
  spin: Float32Array
}

export interface EmitParticleOptions {
  kind: InstancedParticleKind
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  colorHex: number
  lifeSec: number
  startScale: number
  endScale?: number
  gravity?: number
  drag?: number
  spin?: number
}

function budgetForQuality(quality: GraphicsQuality): {
  spark: number
  shard: number
  orb: number
  ring: number
} {
  if (quality === 'pixel') return { spark: 72, shard: 44, orb: 56, ring: 20 }
  if (quality === 'fine_pixel') return { spark: 110, shard: 64, orb: 80, ring: 28 }
  if (quality === 'hd') return { spark: 160, shard: 96, orb: 110, ring: 40 }
  return { spark: 240, shard: 140, orb: 160, ring: 60 }
}

export class VfxInstancedPool {
  private group = new THREE.Group()
  private buckets: Record<InstancedParticleKind, PoolBucket>
  private dummy = new THREE.Object3D()
  private tmpColor = new THREE.Color()
  private tmpVel = new THREE.Vector3()
  private upAxis = new THREE.Vector3(0, 1, 0)
  private tmpQuat = new THREE.Quaternion()
  private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)

  constructor(quality: GraphicsQuality) {
    const cap = budgetForQuality(quality)
    this.buckets = {
      spark: this.createBucket('spark', cap.spark, new THREE.ConeGeometry(2.4, 16, 4)),
      shard: this.createBucket('shard', cap.shard, new THREE.OctahedronGeometry(5.5, 0)),
      orb: this.createBucket('orb', cap.orb, new THREE.IcosahedronGeometry(5.0, 0)),
      ring: this.createBucket('ring', cap.ring, new THREE.TorusGeometry(14, 1.8, 6, 20)),
    }
    this.group.name = 'vfx-instanced-gpu-pool'
  }

  getObject3D(): THREE.Group {
    return this.group
  }

  private createBucket(
    kind: InstancedParticleKind,
    capacity: number,
    geometry: THREE.BufferGeometry,
  ): PoolBucket {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: kind === 'ring' ? 0.82 : 0.94,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })

    const mesh = new THREE.InstancedMesh(geometry, mat, capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.count = capacity

    for (let i = 0; i < capacity; i++) {
      mesh.setMatrixAt(i, this.zeroMatrix)
      mesh.setColorAt(i, this.tmpColor.setHex(0xffffff))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.group.add(mesh)

    return {
      kind,
      capacity,
      cursor: 0,
      mesh,
      active: new Uint8Array(capacity),
      px: new Float32Array(capacity),
      py: new Float32Array(capacity),
      pz: new Float32Array(capacity),
      vx: new Float32Array(capacity),
      vy: new Float32Array(capacity),
      vz: new Float32Array(capacity),
      gravity: new Float32Array(capacity),
      drag: new Float32Array(capacity),
      life: new Float32Array(capacity),
      maxLife: new Float32Array(capacity),
      baseScale: new Float32Array(capacity),
      endScale: new Float32Array(capacity),
      rx: new Float32Array(capacity),
      ry: new Float32Array(capacity),
      rz: new Float32Array(capacity),
      spin: new Float32Array(capacity),
    }
  }

  emit(opts: EmitParticleOptions): void {
    const b = this.buckets[opts.kind]
    const i = b.cursor
    b.cursor = (b.cursor + 1) % b.capacity

    b.active[i] = 1
    b.px[i] = opts.x
    b.py[i] = opts.y
    b.pz[i] = opts.z
    b.vx[i] = opts.vx
    b.vy[i] = opts.vy
    b.vz[i] = opts.vz
    b.gravity[i] = opts.gravity ?? 0
    b.drag[i] = opts.drag ?? 0.94
    b.life[i] = opts.lifeSec
    b.maxLife[i] = Math.max(0.05, opts.lifeSec)
    b.baseScale[i] = opts.startScale
    b.endScale[i] = opts.endScale ?? 0.02
    b.rx[i] = opts.kind === 'ring' ? Math.PI / 2 : Math.random() * Math.PI
    b.ry[i] = Math.random() * Math.PI * 2
    b.rz[i] = Math.random() * Math.PI
    b.spin[i] = opts.spin ?? (opts.kind === 'shard' ? 8.0 : 2.5)

    this.tmpColor.setHex(opts.colorHex)
    b.mesh.setColorAt(i, this.tmpColor)
    if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true
  }

  emitBurst(
    x: number,
    y: number,
    z: number,
    primaryHex: number,
    secondaryHex: number,
    count: number,
    speed: number,
    kind: InstancedParticleKind = 'spark',
  ): void {
    for (let k = 0; k < count; k++) {
      const ang = (k / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.45
      const spd = speed * (0.45 + Math.random() * 0.75)
      this.emit({
        kind,
        x,
        y: y + Math.random() * 10,
        z,
        vx: Math.cos(ang) * spd,
        vy: (kind === 'shard' ? 115 : 80) + Math.random() * (speed * 0.55),
        vz: Math.sin(ang) * spd,
        colorHex: k % 3 === 0 ? secondaryHex : primaryHex,
        lifeSec: 0.28 + Math.random() * 0.34,
        startScale: kind === 'spark' ? 0.9 + Math.random() * 0.65 : 0.7 + Math.random() * 0.55,
        endScale: 0.02,
        gravity: kind === 'shard' ? -360 : -140,
        drag: 0.92,
      })
    }
  }

  emitShockRing(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    lifeSec = 0.36,
  ): void {
    this.emit({
      kind: 'ring',
      x,
      y,
      z,
      vx: 0,
      vy: 0.15,
      vz: 0,
      colorHex,
      lifeSec,
      startScale,
      endScale,
      gravity: 0,
      drag: 1,
      spin: 0,
    })
  }

  update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt))
    const dampingPow = clampedDt * 60

    for (const key of ['spark', 'shard', 'orb', 'ring'] as const) {
      const b = this.buckets[key]
      let dirty = false

      for (let i = 0; i < b.capacity; i++) {
        if (b.active[i] === 0) continue
        dirty = true
        b.life[i] -= clampedDt

        if (b.life[i] <= 0) {
          b.active[i] = 0
          b.mesh.setMatrixAt(i, this.zeroMatrix)
          continue
        }

        const dragFactor = Math.pow(b.drag[i], dampingPow)
        b.vx[i] *= dragFactor
        b.vy[i] = b.vy[i] * dragFactor + b.gravity[i] * clampedDt
        b.vz[i] *= dragFactor

        b.px[i] += b.vx[i] * clampedDt
        b.py[i] = Math.max(2.0, b.py[i] + b.vy[i] * clampedDt)
        b.pz[i] += b.vz[i] * clampedDt

        const t = 1 - b.life[i] / b.maxLife[i]
        // Ease-out expansion/shrink
        const easeOut = 1 - (1 - t) * (1 - t)
        const s = b.baseScale[i] + (b.endScale[i] - b.baseScale[i]) * easeOut

        this.dummy.position.set(b.px[i], b.py[i], b.pz[i])

        if (key === 'spark') {
          this.tmpVel.set(b.vx[i], b.vy[i], b.vz[i])
          const spd = this.tmpVel.length()
          if (spd > 1.0) {
            this.tmpVel.divideScalar(spd)
            this.tmpQuat.setFromUnitVectors(this.upAxis, this.tmpVel)
            this.dummy.quaternion.copy(this.tmpQuat)
          }
          const stretch = Math.min(2.8, 0.75 + spd * 0.0075)
          this.dummy.scale.set(s * 0.72, s * stretch, s * 0.72)
        } else if (key === 'ring') {
          this.dummy.rotation.set(Math.PI / 2, 0, b.rz[i])
          this.dummy.scale.set(s, s, Math.max(0.25, (1 - t) * 1.1))
        } else {
          b.rx[i] += b.spin[i] * clampedDt
          b.ry[i] += b.spin[i] * 0.8 * clampedDt
          this.dummy.rotation.set(b.rx[i], b.ry[i], b.rz[i])
          this.dummy.scale.setScalar(Math.max(0.01, s))
        }

        this.dummy.updateMatrix()
        b.mesh.setMatrixAt(i, this.dummy.matrix)
      }

      if (dirty) {
        b.mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  dispose(): void {
    for (const key of ['spark', 'shard', 'orb', 'ring'] as const) {
      const b = this.buckets[key]
      b.mesh.geometry.dispose()
      ;(b.mesh.material as THREE.Material).dispose()
      this.group.remove(b.mesh)
    }
  }
}

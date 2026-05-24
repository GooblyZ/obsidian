import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useScrollProgress } from '../../hooks/useScrollProgress'

/* ── OBSIDIAN Canvas ─────────────────────────────────────────────────────────
   Three-layer depth particle system with scroll-driven hue shift
   and cursor-reactive near-layer particles.

   Layer 0 — Deep:  280 large, slow, dim    (z: -40 → -20)
   Layer 1 — Mid:   360 medium              (z: -20 →  0)
   Layer 2 — Near:  180 tiny, bright        (z:   0 →  8)  ← mouse-reactive

   Scroll hue arc:
     0%  → violet-blue   entry / void
     35% → violet-teal   fragment
     65% → teal-gold     archive
     100%→ gold-warm     signal

   Near-layer mouse interaction:
     Cursor projects into layer-2 local space. Particles within INFLUENCE
     units receive an outward impulse. A spring force returns them home.
     Velocity decays at DAMP per frame — disturbance fades in ~1.5s.
   ─────────────────────────────────────────────────────────────────────────── */

const LAYERS = [
  { count: 280, zRange: [-40, -20] as [number,number], size: 0.08, opacity: 0.32, speed: 0.006 },
  { count: 360, zRange: [-20,   0] as [number,number], size: 0.05, opacity: 0.48, speed: 0.011 },
  { count: 180, zRange: [  0,   8] as [number,number], size: 0.03, opacity: 0.68, speed: 0.018 },
]

const HUE_STOPS = [
  { at: 0.00, a: new THREE.Color('#7c6fff'), b: new THREE.Color('#4a40c8') },
  { at: 0.35, a: new THREE.Color('#7c6fff'), b: new THREE.Color('#2dd4bf') },
  { at: 0.65, a: new THREE.Color('#2dd4bf'), b: new THREE.Color('#d4af7a') },
  { at: 1.00, a: new THREE.Color('#d4af7a'), b: new THREE.Color('#e8d5b0') },
]

function lerpColors(p: number): [THREE.Color, THREE.Color] {
  for (let i = 0; i < HUE_STOPS.length - 1; i++) {
    const c = HUE_STOPS[i], n = HUE_STOPS[i + 1]
    if (p >= c.at && p <= n.at) {
      const t = (p - c.at) / (n.at - c.at)
      return [c.a.clone().lerp(n.a, t), c.b.clone().lerp(n.b, t)]
    }
  }
  const last = HUE_STOPS[HUE_STOPS.length - 1]
  return [last.a.clone(), last.b.clone()]
}

export function ObsidianCanvas() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const scrollProgress = useScrollProgress()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(0x000000, 0)

    /* ── Scene / Camera ── */
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    camera.position.z = 30

    /* ── Build layers ── */
    const layers: Array<{
      points:    THREE.Points
      material:  THREE.PointsMaterial
      geometry:  THREE.BufferGeometry
      colorAttr: THREE.BufferAttribute
      speed:     number
    }> = []

    LAYERS.forEach((cfg) => {
      const pos  = new Float32Array(cfg.count * 3)
      const col  = new Float32Array(cfg.count * 3)
      const [z0, z1] = cfg.zRange

      for (let i = 0; i < cfg.count; i++) {
        const i3 = i * 3
        const rx = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 100
        const ry = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 70
        pos[i3] = rx;  pos[i3+1] = ry;  pos[i3+2] = z0 + Math.random() * (z1 - z0)
        col[i3] = 0.49; col[i3+1] = 0.44; col[i3+2] = 1.0
      }

      const geometry  = new THREE.BufferGeometry()
      const colorAttr = new THREE.BufferAttribute(col, 3)
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geometry.setAttribute('color', colorAttr)

      const material = new THREE.PointsMaterial({
        size: cfg.size, vertexColors: true,
        transparent: true, opacity: cfg.opacity,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })

      const points = new THREE.Points(geometry, material)
      scene.add(points)
      layers.push({ points, material, geometry, colorAttr, speed: cfg.speed })
    })

    /* ── Resize ── */
    function resize() {
      const w = Math.max(window.innerWidth  || document.documentElement.clientWidth  || 800, 100)
      const h = Math.max(window.innerHeight || document.documentElement.clientHeight || 600, 100)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(document.documentElement)
    window.addEventListener('resize', resize)

    /* ── Near-layer cursor interaction ──────────────────────────────────────
       Layer 2 particles receive an outward impulse when cursor passes nearby.
       A spring pulls them back to their home position.                        */
    const nearLayer   = layers[2]
    const nearCount   = LAYERS[2].count
    const nearPosAttr = nearLayer.geometry.getAttribute('position') as THREE.BufferAttribute
    const nearPosData = nearPosAttr.array as Float32Array

    const homePos = new Float32Array(nearPosData)   /* snapshot of initial positions */
    const velX    = new Float32Array(nearCount)
    const velY    = new Float32Array(nearCount)

    /* Mouse NDC coords — updated by listener, read per frame */
    let mndx = -9999, mndy = -9999
    function onMouseMove(e: MouseEvent) {
      mndx = (e.clientX  / window.innerWidth)  * 2 - 1
      mndy = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    /* Pre-allocated temps — avoid per-frame GC */
    const _v3      = new THREE.Vector3()
    const _invMat  = new THREE.Matrix4()

    const INFLUENCE = 6.5   /* world units of interaction radius */
    const IMPULSE   = 0.20  /* strength of repulsion impulse     */
    const SPRING    = 0.013 /* spring constant back to home      */
    const DAMP      = 0.90  /* velocity damping per frame        */

    /* ── Animation loop ── */
    let raf: number
    let then = performance.now()
    let lastP = -1

    function animate(now: number) {
      raf = requestAnimationFrame(animate)
      const delta = Math.min((now - then) / 1000, 0.05)
      then = now

      const p = scrollProgress.current

      /* Hue update — only when scroll moves */
      if (Math.abs(p - lastP) > 0.003) {
        lastP = p
        const [cA, cB] = lerpColors(p)
        const tmp = new THREE.Color()
        layers.forEach(({ colorAttr }, li) => {
          const arr   = colorAttr.array
          const count = arr.length / 3
          for (let i = 0; i < count; i++) {
            const t  = i / count
            const i3 = i * 3
            if (li % 2 === 0) { tmp.copy(cA).lerp(cB, t) }
            else               { tmp.copy(cB).lerp(cA, t) }
            arr[i3] = tmp.r;  arr[i3+1] = tmp.g;  arr[i3+2] = tmp.b
          }
          colorAttr.needsUpdate = true
        })
      }

      /* Layer rotation */
      layers.forEach(({ points, speed }, i) => {
        points.rotation.y += delta * speed * [0.6, 1.0, 1.4][i]
        points.rotation.x += delta * speed * 0.28
      })

      /* Camera parallax with scroll */
      camera.position.y  = THREE.MathUtils.lerp(camera.position.y,  -p * 7,    0.04)
      camera.rotation.z  = THREE.MathUtils.lerp(camera.rotation.z,   p * 0.04, 0.03)

      /* ── Near layer mouse interaction ── */
      /* Project mouse NDC to world space at z = 4 (mid of near layer) */
      _v3.set(mndx, mndy, 0.5).unproject(camera)
      _v3.sub(camera.position).normalize()
      const tRay = (4 - camera.position.z) / _v3.z
      const wx   = camera.position.x + _v3.x * tRay
      const wy   = camera.position.y + _v3.y * tRay

      /* Transform world mouse to near-layer local space */
      _invMat.copy(nearLayer.points.matrixWorld).invert()
      const lmx = wx * _invMat.elements[0] + wy * _invMat.elements[4] + 4 * _invMat.elements[8]  + _invMat.elements[12]
      const lmy = wx * _invMat.elements[1] + wy * _invMat.elements[5] + 4 * _invMat.elements[9]  + _invMat.elements[13]

      for (let i = 0; i < nearCount; i++) {
        const i3 = i * 3
        const px = nearPosData[i3],  py = nearPosData[i3 + 1]
        const dx = px - lmx,         dy = py - lmy
        const dist2 = dx * dx + dy * dy

        /* Cursor repulsion impulse */
        if (dist2 < INFLUENCE * INFLUENCE && dist2 > 0.01) {
          const dist  = Math.sqrt(dist2)
          const force = (1 - dist / INFLUENCE) * IMPULSE
          velX[i] += (dx / dist) * force
          velY[i] += (dy / dist) * force
        }

        /* Spring toward home position */
        velX[i] += (homePos[i3]     - nearPosData[i3])     * SPRING
        velY[i] += (homePos[i3 + 1] - nearPosData[i3 + 1]) * SPRING

        /* Dampen + integrate */
        velX[i] *= DAMP
        velY[i] *= DAMP
        nearPosData[i3]     += velX[i]
        nearPosData[i3 + 1] += velY[i]
      }
      nearPosAttr.needsUpdate = true

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      ro.disconnect()
      layers.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose() })
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} id="obsidian-canvas" aria-hidden="true" />
}

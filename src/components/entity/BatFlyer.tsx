import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useScrollProgress } from '../../hooks/useScrollProgress'

/* ── BatFlyer v2 ─────────────────────────────────────────────────────────────
   Cinematic scroll-driven 3-D bat, fully procedural (no external assets).

   ANATOMY
   · Body   — CapsuleGeometry, aligned along z
   · Head   — elongated SphereGeometry, positioned forward
   · Ears   — tall tapered ConeGeometry × 2
   · Wings  — bezier ShapeGeometry membrane + CylinderGeometry bone struts
   · Thumb  — small ConeGeometry hook at each wrist position

   WING RIG
   · rPivot / lPivot  — shoulder pivot, rotates z (up/down flap) + x (sweep)
   · rFold  / lFold   — wrist sub-pivot at (0.34, 0, 0), adds secondary fold
     on the upstroke: the outer wing crumples slightly as real bat wings do.

   FLIGHT — 5 stages, each a distinct cinematic beat
   Stage 1 (0.00–0.22) — tiny silhouette, slow approach from left
   Stage 2 (0.22–0.42) — close pass, wide flap, left banking
   Stage 3 (0.42–0.62) — near text, banking cross, lower altitude
   Stage 4 (0.62–0.76) — power dive, opacity fades to zero
   Stage 5 (0.76–1.00) — reappears from upper right, new heading

   ATMOSPHERE
   · Overlay div, opacity driven by bat proximity × opacity
   · #scroll-content gets a brightness + hue-rotate filter when bat is near —
     the text visually responds to the bat without touching GSAP transforms.

   LIGHTING
   · AmbientLight      — very dark blue-violet base
   · DirectionalLight  — moonlight from upper-left (cool blue-purple)
   · PointLight (rim)  — violet, follows bat from behind
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Keyframe timeline ─────────────────────────────────────────────────────── */
interface KF {
  s:       number   /* scroll position 0 → 1        */
  x:       number   /* world x                       */
  y:       number   /* world y                       */
  z:       number   /* world z (positive = closer)   */
  rx:      number   /* body pitch                    */
  ry:      number   /* body yaw (+ = right-facing)   */
  rz:      number   /* body roll / bank              */
  flapAmp: number   /* wing amplitude  0 → 1         */
  flapHz:  number   /* wing beats per second         */
  opacity: number   /* overall opacity of bat mesh   */
}

const KFS: readonly KF[] = [
  /* ── Stage 1: tiny silhouette, slow approach from left ── */
  { s: 0.00, x: -0.9, y:  0.7, z: -3.8, rx: 0.00, ry:  0.28, rz:  0.00, flapAmp: 0.20, flapHz: 0.44, opacity: 0.0 },
  { s: 0.04, x: -0.8, y:  0.7, z: -3.4, rx: 0.00, ry:  0.24, rz:  0.00, flapAmp: 0.24, flapHz: 0.48, opacity: 1.0 },
  { s: 0.13, x: -0.4, y:  0.5, z: -1.9, rx: 0.00, ry:  0.12, rz:  0.00, flapAmp: 0.30, flapHz: 0.56, opacity: 1.0 },
  { s: 0.22, x:  0.1, y:  0.4, z: -0.3, rx: 0.00, ry:  0.00, rz:  0.00, flapAmp: 0.40, flapHz: 0.68, opacity: 1.0 },

  /* ── Stage 2: close pass, wide flap, left banking ── */
  { s: 0.28, x:  0.7, y:  0.6, z:  1.2, rx: 0.00, ry: -0.18, rz: -0.36, flapAmp: 0.64, flapHz: 0.90, opacity: 1.0 },
  { s: 0.35, x:  0.1, y:  0.7, z:  1.6, rx: 0.00, ry: -0.30, rz: -0.44, flapAmp: 0.70, flapHz: 0.95, opacity: 1.0 },
  { s: 0.42, x: -0.8, y:  0.4, z:  1.3, rx: 0.00, ry: -0.36, rz: -0.30, flapAmp: 0.62, flapHz: 0.88, opacity: 1.0 },

  /* ── Stage 3: near text, banking cross, lower altitude ── */
  { s: 0.48, x: -1.2, y:  0.0, z:  0.9, rx: 0.08, ry: -0.24, rz:  0.22, flapAmp: 0.54, flapHz: 0.80, opacity: 1.0 },
  { s: 0.55, x:  0.3, y: -0.2, z:  0.6, rx: 0.06, ry:  0.20, rz:  0.40, flapAmp: 0.50, flapHz: 0.74, opacity: 1.0 },
  { s: 0.62, x:  1.0, y: -0.1, z:  0.4, rx: 0.04, ry:  0.42, rz:  0.24, flapAmp: 0.56, flapHz: 0.82, opacity: 1.0 },

  /* ── Stage 4: power dive, disappears ── */
  { s: 0.68, x:  1.3, y: -0.8, z:  0.1, rx: 0.55, ry:  0.52, rz:  0.32, flapAmp: 0.72, flapHz: 0.96, opacity: 1.0 },
  { s: 0.73, x:  1.5, y: -2.4, z: -0.5, rx: 1.12, ry:  0.56, rz:  0.38, flapAmp: 0.34, flapHz: 0.58, opacity: 0.3 },
  { s: 0.76, x:  1.7, y: -4.0, z: -1.2, rx: 1.35, ry:  0.50, rz:  0.40, flapAmp: 0.14, flapHz: 0.38, opacity: 0.0 },

  /* ── Stage 5: reappear from upper right, new heading ── */
  { s: 0.79, x:  2.4, y:  2.4, z: -2.0, rx:-0.26, ry: -0.52, rz: -0.30, flapAmp: 0.16, flapHz: 0.40, opacity: 0.0 },
  { s: 0.85, x:  1.3, y:  1.1, z: -0.6, rx:-0.10, ry: -0.32, rz: -0.18, flapAmp: 0.44, flapHz: 0.74, opacity: 1.0 },
  { s: 0.93, x:  0.1, y:  0.4, z:  0.5, rx: 0.00, ry: -0.12, rz:  0.00, flapAmp: 0.56, flapHz: 0.86, opacity: 1.0 },
  { s: 1.00, x: -0.5, y:  0.1, z:  0.2, rx: 0.00, ry:  0.10, rz: -0.10, flapAmp: 0.50, flapHz: 0.80, opacity: 0.6 },
]

/* ── Interpolation helpers ─────────────────────────────────────────────────── */
function eio(t: number): number { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t }
function lerp(a: number, b: number, t: number): number { return a + (b-a)*t }

function sample(scroll: number): KF {
  if (scroll <= KFS[0].s)               return { ...KFS[0] }
  if (scroll >= KFS[KFS.length - 1].s)  return { ...KFS[KFS.length - 1] }
  let i = 0
  while (i < KFS.length - 1 && KFS[i+1].s <= scroll) i++
  const a = KFS[i], b = KFS[i+1]
  const t = eio((scroll - a.s) / (b.s - a.s))
  return {
    s:       scroll,
    x:       lerp(a.x,       b.x,       t),
    y:       lerp(a.y,       b.y,       t),
    z:       lerp(a.z,       b.z,       t),
    rx:      lerp(a.rx,      b.rx,      t),
    ry:      lerp(a.ry,      b.ry,      t),
    rz:      lerp(a.rz,      b.rz,      t),
    flapAmp: lerp(a.flapAmp, b.flapAmp, t),
    flapHz:  lerp(a.flapHz,  b.flapHz,  t),
    opacity: lerp(a.opacity,  b.opacity,  t),
  }
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function BatFlyer() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const atmosphereRef  = useRef<HTMLDivElement>(null)
  const scrollProgress = useScrollProgress()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    /* ── Scene / Camera ── */
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 100)
    camera.position.z = 5

    /* ── Resize ── */
    function resize() {
      const w = Math.max(window.innerWidth  || 800, 100)
      const h = Math.max(window.innerHeight || 600, 100)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    /* ── Lighting ── */
    /* 1. Ambient — very dark, cool violet-blue base */
    scene.add(new THREE.AmbientLight(0x0d0822, 0.85))

    /* 2. Moon/key — directional from upper left front, cool blue-purple */
    const moonLight = new THREE.DirectionalLight(0x3d5bb8, 1.35)
    moonLight.position.set(-2.5, 3, 2)
    scene.add(moonLight)

    /* 3. Rim — violet PointLight, follows bat from behind and above */
    const rimLight = new THREE.PointLight(0x6a28ff, 8.0, 18)
    rimLight.position.set(0, 1, 3)
    scene.add(rimLight)

    /* ── Material pool (track for disposal) ── */
    const matPool: THREE.Material[] = []
    const geoPool: THREE.BufferGeometry[] = []

    function trackGeo<G extends THREE.BufferGeometry>(g: G): G { geoPool.push(g); return g }

    const bodyMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x060412),
      emissive:          new THREE.Color(0x1e0948),
      emissiveIntensity: 0.60,
      roughness:         0.88,
      metalness:         0.04,
    })
    matPool.push(bodyMat)

    const wingMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x050310),
      emissive:          new THREE.Color(0x160635),
      emissiveIntensity: 0.50,
      roughness:         0.92,
      metalness:         0.02,
      side:              THREE.DoubleSide,
      transparent:       true,
      opacity:           0.90,
    })
    matPool.push(wingMat)

    /* Bone struts — brighter emissive so they read against the membrane */
    const boneMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x0a0620),
      emissive:          new THREE.Color(0x301262),
      emissiveIntensity: 0.85,
      roughness:         0.80,
      metalness:         0.05,
    })
    matPool.push(boneMat)

    /* ── Bat group ── */
    const bat = new THREE.Group()
    scene.add(bat)

    /* Body — CapsuleGeometry aligned along z (forward axis) */
    const bodyGeo = trackGeo(new THREE.CapsuleGeometry(0.065, 0.12, 5, 10))
    bodyGeo.rotateX(Math.PI / 2)
    bat.add(new THREE.Mesh(bodyGeo, bodyMat))

    /* Head — slightly elongated forward */
    const headGeo = trackGeo(new THREE.SphereGeometry(0.07, 12, 8))
    headGeo.scale(0.9, 0.88, 1.15)
    const headMesh = new THREE.Mesh(headGeo, bodyMat)
    headMesh.position.set(0, 0.018, 0.21)
    bat.add(headMesh)

    /* Ears — tall, tapered (gothic pointed) */
    ;([-1, 1] as const).forEach((side) => {
      const earGeo = trackGeo(new THREE.ConeGeometry(0.020, 0.10, 4))
      const ear = new THREE.Mesh(earGeo, bodyMat)
      ear.position.set(side * 0.044, 0.10, 0.20)
      ear.rotation.z = side * 0.26
      ear.rotation.x = -0.10
      bat.add(ear)
    })

    /* ── Wing factory ─────────────────────────────────────────────────────────
       Builds one wing and returns its shoulder pivot.
       The pivot rotates for flapping; an inner wrist sub-pivot folds the
       outer segment on the upstroke.                                          */

    /* Wing membrane — right hand side, root at (0,0) */
    function makeMembraneShape(): THREE.Shape {
      const s = new THREE.Shape()
      s.moveTo(0, 0)                                               /* shoulder   */
      /* Leading edge: humerus → radius → wrist */
      s.bezierCurveTo( 0.08, 0.04,  0.22, 0.08,  0.34, 0.09)    /* → wrist    */
      /* Continue to digit-2 tip (main span) */
      s.bezierCurveTo( 0.54, 0.11,  0.72, 0.08,  0.84, 0.04)    /* → tip      */
      /* Wingtip curve */
      s.bezierCurveTo( 0.88, 0.02,  0.89,-0.02,  0.86,-0.06)
      /* Through digit-3 and digit-4 positions on trailing edge */
      s.bezierCurveTo( 0.80,-0.09,  0.72,-0.10,  0.70,-0.10)    /* digit-3    */
      s.bezierCurveTo( 0.64,-0.14,  0.56,-0.18,  0.54,-0.18)    /* digit-4    */
      /* Patagium — trailing membrane curves back to shoulder */
      s.bezierCurveTo( 0.38,-0.24,  0.18,-0.27,  0.08,-0.23)
      s.bezierCurveTo( 0.02,-0.18,  0,   -0.09,  0,     0)
      return s
    }

    /* Bone strut between two 2-D points (z ≈ 0.008 so it sits above membrane) */
    function makeStrut(x1: number, y1: number, x2: number, y2: number, r: number): THREE.Mesh {
      const from = new THREE.Vector3(x1, y1, 0.006)
      const to   = new THREE.Vector3(x2, y2, 0.008)
      const len  = from.distanceTo(to)
      const geo  = trackGeo(new THREE.CylinderGeometry(r * 0.55, r, len, 4, 1))
      const mesh = new THREE.Mesh(geo, boneMat)
      mesh.position.copy(from).lerp(to, 0.5)
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize()
      )
      return mesh
    }

    function buildWing(): THREE.Group {
      const shoulder = new THREE.Group()

      /* Membrane */
      const memGeo = trackGeo(new THREE.ShapeGeometry(makeMembraneShape(), 14))
      shoulder.add(new THREE.Mesh(memGeo, wingMat))

      /* Bone struts — humerus, radius, then 3 digits from wrist */
      shoulder.add(makeStrut(0,    0,    0.16, 0.04, 0.008))  /* humerus */
      shoulder.add(makeStrut(0.16, 0.04, 0.34, 0.09, 0.007))  /* radius  */
      shoulder.add(makeStrut(0.34, 0.09, 0.84, 0.04, 0.006))  /* digit-2 */
      shoulder.add(makeStrut(0.34, 0.09, 0.70,-0.10, 0.005))  /* digit-3 */
      shoulder.add(makeStrut(0.34, 0.09, 0.54,-0.18, 0.004))  /* digit-4 */

      /* Thumb hook — small claw at wrist leading edge */
      const thumbGeo = trackGeo(new THREE.ConeGeometry(0.010, 0.050, 4))
      const thumb    = new THREE.Mesh(thumbGeo, bodyMat)
      thumb.position.set(0.34, 0.20, 0.010)
      thumb.rotation.z = -0.22
      shoulder.add(thumb)

      return shoulder
    }

    /* Right wing */
    const rPivot = new THREE.Group()
    rPivot.position.set(0.055, 0, 0)
    rPivot.add(buildWing())
    bat.add(rPivot)

    /* Left wing — x-mirror: scale(-1,1,1) flips everything correctly */
    const lPivot = new THREE.Group()
    lPivot.position.set(-0.055, 0, 0)
    lPivot.scale.x = -1
    lPivot.add(buildWing())
    bat.add(lPivot)

    /* ── Pre-allocated temporaries (no per-frame GC) ── */
    const _scrollContent = document.getElementById('scroll-content')

    /* ── Animation loop ── */
    let raf: number
    let accumulatedTime = 0
    let lastNow = performance.now()

    function animate(now: number) {
      raf = requestAnimationFrame(animate)

      const dt = Math.min((now - lastNow) / 1000, 0.05)
      lastNow  = now
      accumulatedTime += dt   /* used for wing beat phase — survives scroll jumps */

      const scroll = Math.max(0, Math.min(1, scrollProgress.current))
      const kf     = sample(scroll)

      /* ── Bat transform ── */
      bat.position.set(kf.x, kf.y, kf.z)
      bat.rotation.set(kf.rx, kf.ry, kf.rz, 'YXZ')

      /* ── Wing flap ──────────────────────────────────────────────────────────
         Primary  : shoulder pivot rotates z  (up/down)
         Secondary: shoulder pivot rotates x  (forward/back sweep, phase -0.35 rad)
         Fold     : rPivot x rotation on upstroke — outer wing crumples slightly */
      const phase    = accumulatedTime * kf.flapHz * Math.PI * 2
      const flapZ    =  Math.sin(phase)          * kf.flapAmp
      const sweepX   =  Math.sin(phase - 0.35)   * kf.flapAmp * 0.14
      /* Fold: only on upstroke (flapZ > 0), and only the distal half */
      const fold     = Math.max(0, flapZ) * 0.28

      rPivot.rotation.z = flapZ;   rPivot.rotation.x = sweepX
      lPivot.rotation.z = -flapZ;  lPivot.rotation.x = sweepX

      /* Apply fold to the wing group's children directly — no sub-pivot overhead */
      const rWing = rPivot.children[0] as THREE.Group
      const lWing = lPivot.children[0] as THREE.Group
      if (rWing) rWing.rotation.z =  fold
      if (lWing) lWing.rotation.z = -fold

      /* ── Wing opacity reflects flap intensity (fast flap = slightly more transparent) */
      wingMat.opacity = THREE.MathUtils.clamp(0.90 - kf.flapAmp * 0.08, 0.78, 0.92)

      /* ── Rim light — always behind bat relative to camera ── */
      rimLight.position.set(
        kf.x - 0.5,
        kf.y + 0.9,
        kf.z - 2.2
      )

      /* ── Overall opacity ── */
      bat.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
          m.opacity    = Math.min(m.opacity, kf.opacity)
          m.transparent = true
        }
      })

      /* ── Camera parallax — subtly follows bat ── */
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, kf.x * 0.055, 0.022)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, kf.y * 0.035, 0.022)

      /* ── Atmosphere overlay ── */
      /* Presence: highest when bat is close (z > 0) and fully opaque */
      const presence = THREE.MathUtils.clamp(
        kf.opacity * Math.max(0, (kf.z + 1.2) / 2.8),
        0, 1
      )
      if (atmosphereRef.current) {
        atmosphereRef.current.style.opacity = (presence * 0.60).toFixed(3)
      }

      /* ── Text participation: dims + tints scroll-content when bat is near ── */
      if (_scrollContent) {
        if (presence > 0.04) {
          const brightness = (1 - presence * 0.14).toFixed(3)
          const hue        = (presence * 9).toFixed(1)
          _scrollContent.style.filter = `brightness(${brightness}) hue-rotate(${hue}deg)`
        } else {
          _scrollContent.style.filter = ''
        }
      }

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      /* Restore text filter */
      if (_scrollContent) _scrollContent.style.filter = ''
      geoPool.forEach((g) => g.dispose())
      matPool.forEach((m) => m.dispose())
      renderer.dispose()
    }
  }, [])

  return (
    <>
      {/* Transparent WebGL canvas — the bat lives here */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position:      'fixed',
          inset:         0,
          width:         '100%',
          height:        '100%',
          zIndex:        4,
          pointerEvents: 'none',
        }}
      />

      {/* Atmosphere overlay — violet vignette that pulses with bat proximity */}
      <div
        ref={atmosphereRef}
        aria-hidden="true"
        style={{
          position:      'fixed',
          inset:         0,
          zIndex:        3,
          pointerEvents: 'none',
          opacity:       0,
          background:    'radial-gradient(ellipse 72% 72% at 50% 50%, rgba(18,4,52,0.65) 0%, transparent 65%)',
        }}
      />
    </>
  )
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useScrollProgress } from '../../hooks/useScrollProgress'

// ── GLTF scaffold — swap procedural geometry for a real .glb asset ──────────
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// Usage (inside useEffect, after scene is created):
//   const loader = new GLTFLoader()
//   loader.load('/bat.glb', (gltf) => {
//     scene.add(gltf.scene)
//     gltf.scene.traverse((child) => {
//       if ((child as THREE.Mesh).isMesh) batMeshes.push(...)
//     })
//   })
// ────────────────────────────────────────────────────────────────────────────

/* ── BatFlyer v3 ─────────────────────────────────────────────────────────────
   Cinematic scrollytelling — 6 story states, smooth interpolation, animated
   camera, atmospheric fog, and per-segment narrative text.

   ANATOMY (preserved from v2)
   · Body   — CapsuleGeometry, aligned along z
   · Head   — elongated SphereGeometry
   · Ears   — ConeGeometry × 2
   · Wings  — bezier ShapeGeometry membrane + CylinderGeometry bone struts
   · Thumb  — ConeGeometry hook at each wrist

   STORY FORMAT
   · 6 states: progress, batPosition/Rotation/Scale, cameraPosition/Rotation,
     lightIntensity, fogDensity, flapAmp, flapHz, batOpacity, text
   · sampleStory() ease-in-out interpolation between nearest two states
   · Returns flat SampledState struct — no per-frame allocations

   CAMERA
   · Target follows sampleStory cameraPosition/Rotation
   · Current position lerps toward target at factor 0.028 (cinematic lag)

   ATMOSPHERE
   · THREE.FogExp2 density updated each frame from story interpolation
   · Overlay div opacity driven by bat proximity × batOpacity
   · #scroll-content filter: brightness + hue-rotate

   TEXT OVERLAY
   · Fixed, centered at bottom third — section label + narrative copy
   · Updated via DOM refs (zero React re-renders)
   · Per-segment fade/slide: in over first 20%, full 20–80%, out last 20%

   FALLBACKS
   · Reduced-motion: single static render at story[2], no RAF loop
   · Mobile: 0.65× scale multiplier, reduced pixel ratio, no antialiasing
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Story data ─────────────────────────────────────────────────────────────── */
interface StoryState {
  progress:       number
  batPosition:    [number, number, number]
  batRotation:    [number, number, number]
  batScale:       number
  cameraPosition: [number, number, number]
  cameraRotation: [number, number, number]
  lightIntensity: number
  fogDensity:     number
  flapAmp:        number   /* wing amplitude 0→1 */
  flapHz:         number   /* beats per second   */
  batOpacity:     number   /* overall bat opacity */
  text:           string
}

const STORY: readonly StoryState[] = [
  {
    progress: 0,
    batPosition: [0, 1, 4], batRotation: [0, 0, 0], batScale: 1.0,
    cameraPosition: [0, 0, 8], cameraRotation: [0, 0, 0],
    lightIntensity: 1.0, fogDensity: 0.020,
    flapAmp: 0.22, flapHz: 0.50, batOpacity: 0.0,
    text: 'When uncertainty begins',
  },
  {
    progress: 0.18,
    batPosition: [-2, 1.4, 2], batRotation: [0.2, -0.8, 0.1], batScale: 1.05,
    cameraPosition: [1, 0.5, 6], cameraRotation: [0.05, -0.15, 0],
    lightIntensity: 1.3, fogDensity: 0.025,
    flapAmp: 0.48, flapHz: 0.72, batOpacity: 1.0,
    text: 'We identify the risk',
  },
  {
    progress: 0.36,
    batPosition: [1.8, 0.8, 0], batRotation: [-0.1, 1.2, -0.2], batScale: 0.95,
    cameraPosition: [-1, 1, 5], cameraRotation: [0.1, 0.2, 0],
    lightIntensity: 1.6, fogDensity: 0.018,
    flapAmp: 0.60, flapHz: 0.86, batOpacity: 1.0,
    text: 'We build the strategy',
  },
  {
    progress: 0.56,
    batPosition: [0, 1.7, -1.5], batRotation: [0.3, 2.2, 0.15], batScale: 1.15,
    cameraPosition: [0, 1.4, 4.2], cameraRotation: [0.12, 0, 0],
    lightIntensity: 2.0, fogDensity: 0.012,
    flapAmp: 0.72, flapHz: 0.98, batOpacity: 1.0,
    text: 'We move with precision',
  },
  {
    progress: 0.76,
    batPosition: [-1.4, 1.1, -3], batRotation: [-0.2, 3.1, -0.1], batScale: 1.0,
    cameraPosition: [1.2, 0.8, 3.6], cameraRotation: [0.05, -0.25, 0],
    lightIntensity: 1.7, fogDensity: 0.015,
    flapAmp: 0.55, flapHz: 0.80, batOpacity: 1.0,
    text: 'Every detail matters',
  },
  {
    progress: 1,
    batPosition: [0, 1.2, -4.5], batRotation: [0, 6.28, 0], batScale: 1.2,
    cameraPosition: [0, 0.8, 3], cameraRotation: [0.05, 0, 0],
    lightIntensity: 2.4, fogDensity: 0.008,
    flapAmp: 0.40, flapHz: 0.68, batOpacity: 0.6,
    text: 'Your case. Our strategy.',
  },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

/* ── Interpolation helpers ──────────────────────────────────────────────────── */
function eio(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

interface SampledState {
  /* Bat */
  bx: number; by: number; bz: number
  brx: number; bry: number; brz: number
  bScale: number
  batOpacity: number
  /* Camera target */
  cx: number; cy: number; cz: number
  crx: number; cry: number; crz: number
  /* Scene */
  lightIntensity: number
  fogDensity:     number
  /* Wings */
  flapAmp: number
  flapHz:  number
  /* Segment index — which of the two surrounding states is earlier */
  storyIdx: number
}

function sampleStory(scroll: number): SampledState {
  const s = STORY

  /* Clamp to first */
  if (scroll <= s[0].progress) {
    const a = s[0]
    return {
      bx: a.batPosition[0], by: a.batPosition[1], bz: a.batPosition[2],
      brx: a.batRotation[0], bry: a.batRotation[1], brz: a.batRotation[2],
      bScale: a.batScale, batOpacity: a.batOpacity,
      cx: a.cameraPosition[0], cy: a.cameraPosition[1], cz: a.cameraPosition[2],
      crx: a.cameraRotation[0], cry: a.cameraRotation[1], crz: a.cameraRotation[2],
      lightIntensity: a.lightIntensity, fogDensity: a.fogDensity,
      flapAmp: a.flapAmp, flapHz: a.flapHz, storyIdx: 0,
    }
  }

  /* Clamp to last */
  if (scroll >= s[s.length - 1].progress) {
    const a = s[s.length - 1]
    return {
      bx: a.batPosition[0], by: a.batPosition[1], bz: a.batPosition[2],
      brx: a.batRotation[0], bry: a.batRotation[1], brz: a.batRotation[2],
      bScale: a.batScale, batOpacity: a.batOpacity,
      cx: a.cameraPosition[0], cy: a.cameraPosition[1], cz: a.cameraPosition[2],
      crx: a.cameraRotation[0], cry: a.cameraRotation[1], crz: a.cameraRotation[2],
      lightIntensity: a.lightIntensity, fogDensity: a.fogDensity,
      flapAmp: a.flapAmp, flapHz: a.flapHz, storyIdx: s.length - 1,
    }
  }

  /* Find surrounding pair */
  let i = 0
  while (i < s.length - 1 && s[i + 1].progress <= scroll) i++
  const a = s[i], b = s[i + 1]
  const t = eio((scroll - a.progress) / (b.progress - a.progress))

  return {
    bx:    lerp(a.batPosition[0],    b.batPosition[0],    t),
    by:    lerp(a.batPosition[1],    b.batPosition[1],    t),
    bz:    lerp(a.batPosition[2],    b.batPosition[2],    t),
    brx:   lerp(a.batRotation[0],    b.batRotation[0],    t),
    bry:   lerp(a.batRotation[1],    b.batRotation[1],    t),
    brz:   lerp(a.batRotation[2],    b.batRotation[2],    t),
    bScale:      lerp(a.batScale,        b.batScale,          t),
    batOpacity:  lerp(a.batOpacity,      b.batOpacity,        t),
    cx:    lerp(a.cameraPosition[0], b.cameraPosition[0], t),
    cy:    lerp(a.cameraPosition[1], b.cameraPosition[1], t),
    cz:    lerp(a.cameraPosition[2], b.cameraPosition[2], t),
    crx:   lerp(a.cameraRotation[0], b.cameraRotation[0], t),
    cry:   lerp(a.cameraRotation[1], b.cameraRotation[1], t),
    crz:   lerp(a.cameraRotation[2], b.cameraRotation[2], t),
    lightIntensity: lerp(a.lightIntensity, b.lightIntensity, t),
    fogDensity:     lerp(a.fogDensity,     b.fogDensity,     t),
    flapAmp: lerp(a.flapAmp, b.flapAmp, t),
    flapHz:  lerp(a.flapHz,  b.flapHz,  t),
    storyIdx: i,
  }
}

/* ── Component ──────────────────────────────────────────────────────────────── */
export function BatFlyer() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const atmosphereRef  = useRef<HTMLDivElement>(null)
  const textWrapRef    = useRef<HTMLDivElement>(null)
  const textLabelRef   = useRef<HTMLSpanElement>(null)
  const textCopyRef    = useRef<HTMLSpanElement>(null)
  const scrollProgress = useScrollProgress()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* ── Device capability flags ── */
    const isMobile          = window.matchMedia('(max-width: 640px)').matches
    const reducedMotion     = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scaleMul          = isMobile ? 0.65 : 1.0

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      alpha: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
    renderer.setClearColor(0x000000, 0)

    /* ── Scene / Camera ── */
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 100)

    /* Fog — density controlled by scroll story */
    scene.fog = new THREE.FogExp2(0x06080d, STORY[0].fogDensity)

    camera.position.set(
      STORY[0].cameraPosition[0],
      STORY[0].cameraPosition[1],
      STORY[0].cameraPosition[2],
    )

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
    scene.add(new THREE.AmbientLight(0x0d0822, 0.85))

    const moonLight = new THREE.DirectionalLight(0x3d5bb8, STORY[0].lightIntensity)
    moonLight.position.set(-2.5, 3, 2)
    scene.add(moonLight)

    const rimLight = new THREE.PointLight(0x6a28ff, 8.0, 18)
    rimLight.position.set(0, 1, 3)
    scene.add(rimLight)

    /* ── Geometry / material pools (tracked for disposal) ── */
    const matPool: THREE.Material[]       = []
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

    const boneMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x0a0620),
      emissive:          new THREE.Color(0x301262),
      emissiveIntensity: 0.85,
      roughness:         0.80,
      metalness:         0.05,
    })
    matPool.push(boneMat)

    /* ── Bat anatomy ─────────────────────────────────────────────────────────── */
    const bat = new THREE.Group()
    scene.add(bat)

    /* Body — capsule aligned along z */
    const bodyGeo = trackGeo(new THREE.CapsuleGeometry(0.065, 0.12, 5, 10))
    bodyGeo.rotateX(Math.PI / 2)
    bat.add(new THREE.Mesh(bodyGeo, bodyMat))

    /* Head — elongated forward */
    const headGeo = trackGeo(new THREE.SphereGeometry(0.07, 12, 8))
    headGeo.scale(0.9, 0.88, 1.15)
    const headMesh = new THREE.Mesh(headGeo, bodyMat)
    headMesh.position.set(0, 0.018, 0.21)
    bat.add(headMesh)

    /* Ears — tall, tapered */
    ;([-1, 1] as const).forEach((side) => {
      const earGeo = trackGeo(new THREE.ConeGeometry(0.020, 0.10, 4))
      const ear    = new THREE.Mesh(earGeo, bodyMat)
      ear.position.set(side * 0.044, 0.10, 0.20)
      ear.rotation.z = side * 0.26
      ear.rotation.x = -0.10
      bat.add(ear)
    })

    /* ── Wing factory ─────────────────────────────────────────────────────────
       Membrane bezier + CylinderGeometry bone struts + thumb hook.            */
    function makeMembraneShape(): THREE.Shape {
      const s = new THREE.Shape()
      s.moveTo(0, 0)
      s.bezierCurveTo( 0.08, 0.04,  0.22, 0.08,  0.34, 0.09)
      s.bezierCurveTo( 0.54, 0.11,  0.72, 0.08,  0.84, 0.04)
      s.bezierCurveTo( 0.88, 0.02,  0.89,-0.02,  0.86,-0.06)
      s.bezierCurveTo( 0.80,-0.09,  0.72,-0.10,  0.70,-0.10)
      s.bezierCurveTo( 0.64,-0.14,  0.56,-0.18,  0.54,-0.18)
      s.bezierCurveTo( 0.38,-0.24,  0.18,-0.27,  0.08,-0.23)
      s.bezierCurveTo( 0.02,-0.18,  0,   -0.09,  0,     0  )
      return s
    }

    function makeStrut(x1: number, y1: number, x2: number, y2: number, r: number): THREE.Mesh {
      const from = new THREE.Vector3(x1, y1, 0.006)
      const to   = new THREE.Vector3(x2, y2, 0.008)
      const len  = from.distanceTo(to)
      const geo  = trackGeo(new THREE.CylinderGeometry(r * 0.55, r, len, 4, 1))
      const mesh = new THREE.Mesh(geo, boneMat)
      mesh.position.copy(from).lerp(to, 0.5)
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize(),
      )
      return mesh
    }

    function buildWing(): THREE.Group {
      const shoulder = new THREE.Group()
      const memGeo   = trackGeo(new THREE.ShapeGeometry(makeMembraneShape(), 14))
      shoulder.add(new THREE.Mesh(memGeo, wingMat))
      shoulder.add(makeStrut(0,    0,    0.16, 0.04, 0.008))  /* humerus */
      shoulder.add(makeStrut(0.16, 0.04, 0.34, 0.09, 0.007))  /* radius  */
      shoulder.add(makeStrut(0.34, 0.09, 0.84, 0.04, 0.006))  /* digit-2 */
      shoulder.add(makeStrut(0.34, 0.09, 0.70,-0.10, 0.005))  /* digit-3 */
      shoulder.add(makeStrut(0.34, 0.09, 0.54,-0.18, 0.004))  /* digit-4 */
      const thumbGeo = trackGeo(new THREE.ConeGeometry(0.010, 0.050, 4))
      const thumb    = new THREE.Mesh(thumbGeo, bodyMat)
      thumb.position.set(0.34, 0.20, 0.010)
      thumb.rotation.z = -0.22
      shoulder.add(thumb)
      return shoulder
    }

    /* Shoulder pivots — rotate for flapping */
    const rPivot = new THREE.Group()
    rPivot.position.set(0.055, 0, 0)
    rPivot.add(buildWing())
    bat.add(rPivot)

    const lPivot = new THREE.Group()
    lPivot.position.set(-0.055, 0, 0)
    lPivot.scale.x = -1          /* mirror */
    lPivot.add(buildWing())
    bat.add(lPivot)

    /* ── Pre-collect meshes for opacity (no per-frame traverse) ── */
    interface MeshEntry { mat: THREE.MeshStandardMaterial; baseOpacity: number }
    const batMeshes: MeshEntry[] = []
    bat.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        batMeshes.push({ mat, baseOpacity: mat.opacity })
        mat.transparent = true
      }
    })

    /* ── Static refs ── */
    const _scrollContent = document.getElementById('scroll-content')

    /* ── Camera lag state — current position that lerps toward target ── */
    let ccx  = STORY[0].cameraPosition[0]
    let ccy  = STORY[0].cameraPosition[1]
    let ccz  = STORY[0].cameraPosition[2]
    let ccrx = STORY[0].cameraRotation[0]
    let ccry = STORY[0].cameraRotation[1]
    let ccrz = STORY[0].cameraRotation[2]

    /* ── Text tracking ── */
    let lastTextIdx = -1

    /* ────────────────────────────────────────────────────────────────────────
       REDUCED-MOTION PATH — single static render at story[2], no RAF         */
    if (reducedMotion) {
      const st = STORY[2]
      bat.position.set(st.batPosition[0], st.batPosition[1], st.batPosition[2])
      bat.rotation.set(st.batRotation[0], st.batRotation[1], st.batRotation[2], 'YXZ')
      bat.scale.setScalar(st.batScale * scaleMul)
      camera.position.set(st.cameraPosition[0], st.cameraPosition[1], st.cameraPosition[2])
      camera.rotation.set(st.cameraRotation[0], st.cameraRotation[1], st.cameraRotation[2], 'YXZ')
      moonLight.intensity = st.lightIntensity
      ;(scene.fog as THREE.FogExp2).density = st.fogDensity
      batMeshes.forEach(({ mat, baseOpacity }) => { mat.opacity = baseOpacity * st.batOpacity })
      renderer.render(scene, camera)

      return () => {
        window.removeEventListener('resize', resize)
        geoPool.forEach((g) => g.dispose())
        matPool.forEach((m) => m.dispose())
        renderer.dispose()
      }
    }

    /* ────────────────────────────────────────────────────────────────────────
       ANIMATION LOOP                                                          */
    let raf:             number
    let accumulatedTime  = 0
    let lastNow          = performance.now()

    function animate(now: number) {
      raf = requestAnimationFrame(animate)

      const dt = Math.min((now - lastNow) / 1000, 0.05)
      lastNow          = now
      accumulatedTime += dt

      const scroll = Math.max(0, Math.min(1, scrollProgress.current))
      const kf     = sampleStory(scroll)

      /* ── Bat transform ── */
      bat.position.set(kf.bx, kf.by, kf.bz)
      bat.rotation.set(kf.brx, kf.bry, kf.brz, 'YXZ')
      bat.scale.setScalar(kf.bScale * scaleMul)

      /* ── Wing flap ──────────────────────────────────────────────────────────
         Primary z-rotation (up/down flap) + forward x-sweep (phase-lagged)
         Fold on upstroke: outer wing crumples, as real bat wings do.          */
      const phase  = accumulatedTime * kf.flapHz * Math.PI * 2
      const flapZ  =  Math.sin(phase)        * kf.flapAmp
      const sweepX =  Math.sin(phase - 0.35) * kf.flapAmp * 0.14
      const fold   = Math.max(0, flapZ) * 0.28

      rPivot.rotation.z = flapZ;   rPivot.rotation.x = sweepX
      lPivot.rotation.z = -flapZ;  lPivot.rotation.x = sweepX

      const rWing = rPivot.children[0] as THREE.Group
      const lWing = lPivot.children[0] as THREE.Group
      if (rWing) rWing.rotation.z =  fold
      if (lWing) lWing.rotation.z = -fold

      /* ── Opacity — combined flap modulation × overall batOpacity ── */
      const wingFlap = THREE.MathUtils.clamp(0.90 - kf.flapAmp * 0.08, 0.78, 0.92)
      batMeshes.forEach(({ mat, baseOpacity }) => {
        const base = mat === wingMat ? wingFlap : baseOpacity
        mat.opacity = base * kf.batOpacity
      })

      /* ── Camera — cinematic lag toward story target ── */
      const camF = 0.028
      ccx  = lerp(ccx,  kf.cx,  camF)
      ccy  = lerp(ccy,  kf.cy,  camF)
      ccz  = lerp(ccz,  kf.cz,  camF)
      ccrx = lerp(ccrx, kf.crx, camF)
      ccry = lerp(ccry, kf.cry, camF)
      ccrz = lerp(ccrz, kf.crz, camF)
      camera.position.set(ccx, ccy, ccz)
      camera.rotation.set(ccrx, ccry, ccrz, 'YXZ')

      /* ── Fog density ── */
      ;(scene.fog as THREE.FogExp2).density = kf.fogDensity

      /* ── Moonlight intensity follows story ── */
      moonLight.intensity = kf.lightIntensity

      /* ── Rim light — stays behind bat relative to camera ── */
      rimLight.position.set(kf.bx - 0.5, kf.by + 0.9, kf.bz - 2.2)

      /* ── Atmosphere overlay ── */
      const presence = THREE.MathUtils.clamp(
        kf.batOpacity * Math.max(0, (kf.bz + 1.2) / 2.8),
        0, 1,
      )
      if (atmosphereRef.current) {
        atmosphereRef.current.style.opacity = (presence * 0.60).toFixed(3)
      }

      /* ── Scroll-content filter: dims + tints when bat is near ── */
      if (_scrollContent) {
        if (presence > 0.04) {
          const brightness = (1 - presence * 0.14).toFixed(3)
          const hue        = (presence * 9).toFixed(1)
          _scrollContent.style.filter = `brightness(${brightness}) hue-rotate(${hue}deg)`
        } else {
          _scrollContent.style.filter = ''
        }
      }

      /* ── Narrative text ─────────────────────────────────────────────────────
         Each story segment gets its own text beat.
         Envelope: fade in over first 20%, hold 20–80%, fade out last 20%.
         Vertical slide: enters from +12 px, exits to -12 px.                  */
      const idx      = kf.storyIdx
      const segStart = STORY[idx].progress
      const segEnd   = idx < STORY.length - 1 ? STORY[idx + 1].progress : segStart + 0.001
      const localT   = Math.min(1, (scroll - segStart) / (segEnd - segStart))

      let textOpacity: number
      if (localT < 0.20)      textOpacity = localT / 0.20
      else if (localT < 0.80) textOpacity = 1
      else                    textOpacity = 1 - (localT - 0.80) / 0.20

      const textY: number =
        localT < 0.20 ? (1 - localT / 0.20) * 12
        : localT > 0.80 ? -((localT - 0.80) / 0.20) * 12
        : 0

      /* Update DOM content only when segment changes */
      if (idx !== lastTextIdx) {
        lastTextIdx = idx
        if (textLabelRef.current) textLabelRef.current.textContent = `§ ${ROMAN[idx]}`
        if (textCopyRef.current)  textCopyRef.current.textContent  = STORY[idx].text
      }

      if (textWrapRef.current) {
        textWrapRef.current.style.opacity   = textOpacity.toFixed(3)
        textWrapRef.current.style.transform =
          `translateX(-50%) translateY(${textY.toFixed(1)}px)`
      }

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      if (_scrollContent) _scrollContent.style.filter = ''
      geoPool.forEach((g) => g.dispose())
      matPool.forEach((m) => m.dispose())
      renderer.dispose()
    }
  }, [])

  return (
    <>
      {/* Transparent WebGL canvas — bat lives here */}
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

      {/* Atmosphere vignette — violet bloom, driven by bat proximity */}
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

      {/* Narrative text overlay — per-segment cinematic copy */}
      <div
        ref={textWrapRef}
        aria-live="polite"
        style={{
          position:      'fixed',
          bottom:        '12dvh',
          left:          '50%',
          transform:     'translateX(-50%)',
          zIndex:        5,
          pointerEvents: 'none',
          opacity:       0,
          textAlign:     'center',
          willChange:    'opacity, transform',
        }}
      >
        <span
          ref={textLabelRef}
          style={{
            display:       'block',
            fontFamily:    'var(--font-body)',
            fontSize:      '0.60rem',
            letterSpacing: '0.24em',
            color:         'rgba(169,159,255,0.50)',
            marginBottom:  '0.7rem',
            textTransform: 'uppercase',
          }}
        >
          § I
        </span>
        <span
          ref={textCopyRef}
          style={{
            display:       'block',
            fontFamily:    'var(--font-display)',
            fontSize:      'clamp(1.05rem, 2.6vw, 1.6rem)',
            fontWeight:    300,
            letterSpacing: '0.04em',
            color:         'rgba(228,222,255,0.85)',
            maxWidth:      '36rem',
            lineHeight:    1.35,
          }}
        >
          When uncertainty begins
        </span>
      </div>
    </>
  )
}

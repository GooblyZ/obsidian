import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader }  from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { mousePos }           from '../../lib/mousePosition'

/* ── BatFlyer v7 ─────────────────────────────────────────────────────────────
   Real skeletal GLB bat — DRACO-compressed, 177-channel armature.
   GLB: /public/bat.glb  (104 KB · "Armature|Take 001|BaseLayer" · 0.3 s loop)

   GLB QUIRKS HANDLED AUTOMATICALLY
   · Blender bakes a 0.01 unit-scale + 90° X rotation into the Armature root.
   · onLoad: Box3.setFromObject() measures the actual world-space size, then
     gltf.scene is rescaled so the bat's largest dimension = TARGET_SIZE units
     and recentered so its bounding-box center lands at batGroup origin.
   · No magic constants — the normalization is purely data-driven.

   ARCHITECTURE
   ┌ batGroup          — world position / rotation / scale from scrollStory
   └  └ gltf.scene     — AnimationMixer drives all 61 bones

   CINEMATIC LAYERS
   · scrollStory       — 6 states, ease-in-out interpolation
   · procedural float  — gentle sin/cos drift on top (does not conflict with mixer)
   · camera lag        — cinematic 0.028 factor lerp toward story target
   · mouse parallax    — ±0.06 / ±0.04 fine nudge after lag
   · final-section     — IntersectionObserver on #scene-signal; bat slowly follows
                         cursor when "Are you still here?" is visible (desktop only)

   STORY DESIGN  (bat normalized to ~2.2 units wingspan, 65° FOV)
   Distance formula: D = camZ − batZ   fill% ≈ 0.97 / D
   ┌────────────────────┬─────┬──────┬──────┐
   │ State              │  D  │ fill │ mood │
   ├────────────────────┼─────┼──────┼──────┤
   │ 0  intro (hidden)  │ 3.5 │  28% │ dark │
   │ 1  left reveal     │ 4.0 │  24% │ fly  │
   │ 2  right foreground│ 3.5 │  28% │ fast │
   │ 3  head-on (peak)  │ 2.3 │  42% │ max  │
   │ 4  banking retreat │ 5.0 │  19% │ calm │
   │ 5  fog departure   │ 6.5 │  15% │ dark │
   └────────────────────┴─────┴──────┴──────┘
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Constants ──────────────────────────────────────────────────────────────── */
/** Target wingspan in world units after normalization. */
const TARGET_SIZE = 2.2

/* ── Story data ─────────────────────────────────────────────────────────────── */
interface StoryState {
  progress:       number
  batPosition:    [number, number, number]
  batRotation:    [number, number, number]   /* Euler YXZ in radians */
  batScale:       number
  cameraPosition: [number, number, number]
  cameraRotation: [number, number, number]
  lightIntensity: number
  fogDensity:     number
  flapAmp:        number
  batOpacity:     number
  text:           string
}

const STORY: readonly StoryState[] = [
  /* 0 — dark intro, bat staged right, opacity zero */
  {
    progress: 0,
    batPosition:    [ 0.6,  0.3,  2.5], batRotation: [0.00, -0.35,  0.00], batScale: 1.0,
    cameraPosition: [ 0.0,  0.0,  6.0], cameraRotation: [0.00,  0.00,  0.00],
    lightIntensity: 1.0, fogDensity: 0.018, flapAmp: 0.25, batOpacity: 0.0,
    text: 'When uncertainty begins',
  },
  /* 1 — first reveal, left wing sweep */
  {
    progress: 0.18,
    batPosition:    [-1.3,  0.5,  1.5], batRotation: [0.12,  0.65,  0.18], batScale: 1.0,
    cameraPosition: [ 0.2,  0.0,  5.5], cameraRotation: [0.02, -0.06,  0.00],
    lightIntensity: 1.4, fogDensity: 0.020, flapAmp: 0.52, batOpacity: 1.0,
    text: 'We identify the risk',
  },
  /* 2 — foreground right cross, close pass */
  {
    progress: 0.36,
    batPosition:    [ 1.8,  0.1,  1.2], batRotation: [-0.08, -1.05, -0.18], batScale: 1.0,
    cameraPosition: [-0.2,  0.3,  4.8], cameraRotation: [0.03,  0.08,  0.00],
    lightIntensity: 1.8, fogDensity: 0.014, flapAmp: 0.65, batOpacity: 1.0,
    text: 'We build the strategy',
  },
  /* 3 — head-on approach, peak drama, bat faces camera */
  {
    progress: 0.56,
    batPosition:    [ 0.0,  0.5,  1.5], batRotation: [0.10,  3.14159,  0.05], batScale: 1.1,
    cameraPosition: [ 0.0,  0.4,  3.8], cameraRotation: [0.05,  0.00,  0.00],
    lightIntensity: 2.2, fogDensity: 0.009, flapAmp: 0.78, batOpacity: 1.0,
    text: 'We move with precision',
  },
  /* 4 — banking away left, profile silhouette */
  {
    progress: 0.76,
    batPosition:    [-1.1,  0.9, -1.2], batRotation: [-0.12,  2.65, -0.10], batScale: 1.0,
    cameraPosition: [ 0.3,  0.7,  3.8], cameraRotation: [0.04, -0.10,  0.00],
    lightIntensity: 1.9, fogDensity: 0.012, flapAmp: 0.50, batOpacity: 1.0,
    text: 'Every detail matters',
  },
  /* 5 — receding into fog, outro */
  {
    progress: 1,
    batPosition:    [ 0.3,  1.3, -3.0], batRotation: [0.05,  5.80,  0.04], batScale: 0.9,
    cameraPosition: [ 0.0,  0.8,  3.5], cameraRotation: [0.04,  0.00,  0.00],
    lightIntensity: 2.0, fogDensity: 0.010, flapAmp: 0.35, batOpacity: 0.45,
    text: 'Your case. Our strategy.',
  },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

/* ── Interpolation helpers ──────────────────────────────────────────────────── */
function eio(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

interface Sampled {
  bx: number; by: number; bz: number
  brx: number; bry: number; brz: number
  bScale: number; batOpacity: number
  cx: number; cy: number; cz: number
  crx: number; cry: number; crz: number
  lightIntensity: number; fogDensity: number
  flapAmp: number; storyIdx: number
}

function sampleStory(scroll: number): Sampled {
  const s = STORY

  function fromState(a: StoryState, idx: number): Sampled {
    return {
      bx: a.batPosition[0], by: a.batPosition[1], bz: a.batPosition[2],
      brx: a.batRotation[0], bry: a.batRotation[1], brz: a.batRotation[2],
      bScale: a.batScale, batOpacity: a.batOpacity,
      cx: a.cameraPosition[0], cy: a.cameraPosition[1], cz: a.cameraPosition[2],
      crx: a.cameraRotation[0], cry: a.cameraRotation[1], crz: a.cameraRotation[2],
      lightIntensity: a.lightIntensity, fogDensity: a.fogDensity,
      flapAmp: a.flapAmp, storyIdx: idx,
    }
  }

  if (scroll <= s[0].progress)             return fromState(s[0], 0)
  if (scroll >= s[s.length - 1].progress)  return fromState(s[s.length - 1], s.length - 1)

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
    bScale:         lerp(a.batScale,        b.batScale,        t),
    batOpacity:     lerp(a.batOpacity,      b.batOpacity,      t),
    cx:    lerp(a.cameraPosition[0], b.cameraPosition[0], t),
    cy:    lerp(a.cameraPosition[1], b.cameraPosition[1], t),
    cz:    lerp(a.cameraPosition[2], b.cameraPosition[2], t),
    crx:   lerp(a.cameraRotation[0], b.cameraRotation[0], t),
    cry:   lerp(a.cameraRotation[1], b.cameraRotation[1], t),
    crz:   lerp(a.cameraRotation[2], b.cameraRotation[2], t),
    lightIntensity: lerp(a.lightIntensity, b.lightIntensity, t),
    fogDensity:     lerp(a.fogDensity,     b.fogDensity,     t),
    flapAmp:        lerp(a.flapAmp,        b.flapAmp,        t),
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

    /* ── Device flags ── */
    const isMobile      = window.matchMedia('(max-width: 640px)').matches
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scaleMul      = isMobile ? 0.65 : 1.0

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
    renderer.setClearColor(0x000000, 0)

    /* ── Scene / Camera ── */
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 100)
    scene.fog    = new THREE.FogExp2(0x06080d, STORY[0].fogDensity)
    camera.position.set(...STORY[0].cameraPosition)

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

    /* ── Lighting ─────────────────────────────────────────────────────────────
       1  Ambient  — dark blue-violet base (always on)
       2  Moon     — cool directional from upper-left, intensity from story
       3  Rim      — violet point trailing bat from behind
       4  Fill     — warm amber from below for underside modeling
       5  Accent   — teal point from front, fades with batOpacity            */
    scene.add(new THREE.AmbientLight(0x0d0822, 0.85))

    const moonLight = new THREE.DirectionalLight(0x3d5bb8, STORY[0].lightIntensity)
    moonLight.position.set(-2.5, 3, 2)
    scene.add(moonLight)

    const rimLight = new THREE.PointLight(0x6a28ff, 8.0, 18)
    scene.add(rimLight)

    const fillLight = new THREE.PointLight(0x3d1a00, 2.2, 14)
    fillLight.position.set(0, -3, 0)
    scene.add(fillLight)

    const accentLight = new THREE.PointLight(0x00e8c8, 3.5, 10)
    scene.add(accentLight)

    /* ── Bat material — overrides the GLB's default grey lambert1 ── */
    const batMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x080318),
      emissive:          new THREE.Color(0x1d0545),
      emissiveIntensity: 0.70,
      roughness:         0.84,
      metalness:         0.05,
      side:              THREE.DoubleSide,
      transparent:       true,
      opacity:           1.0,
    })

    /* ── Bat group — parent for story-driven positioning ── */
    const batGroup = new THREE.Group()
    scene.add(batGroup)

    /* ── GLB loading ─────────────────────────────────────────────────────────
       After load:
         1. Override material on every mesh
         2. Normalize: Box3 → scale gltf.scene so max dim = TARGET_SIZE
         3. Center: shift gltf.scene so bounding-box center = batGroup origin
         4. Start AnimationMixer on the single embedded clip               */
    let batReady = false
    let mixer:  THREE.AnimationMixer | null = null
    let action: THREE.AnimationAction | null = null

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')

    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load('/bat.glb', (gltf) => {

      /* 1 — Apply material */
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = batMat
        }
      })

      /* 2 — Add to batGroup, then force matrix update so Box3 is accurate */
      batGroup.add(gltf.scene)
      gltf.scene.updateWorldMatrix(true, true)

      /* 3 — Normalize size ─────────────────────────────────────────────────
         setFromObject with precise:true reads geometry buffers directly,
         bypassing SkinnedMesh deformation — gives rest-pose bounding box.
         This correctly accounts for the Armature's embedded 0.01 scale and
         90° X rotation baked in by Blender's glTF exporter.                */
      const box  = new THREE.Box3().setFromObject(gltf.scene, true)
      const size = new THREE.Vector3()
      const ctr  = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(ctr)

      const maxDim = Math.max(size.x, size.y, size.z)

      if (maxDim > 0) {
        const normScale = TARGET_SIZE / maxDim

        /* Scale the armature root (not batGroup) so the mixer is unaffected */
        gltf.scene.scale.multiplyScalar(normScale)

        /* Center: the old center scaled proportionally, negate to offset it */
        gltf.scene.position.set(
          -ctr.x * normScale,
          -ctr.y * normScale,
          -ctr.z * normScale,
        )
      }

      /* 4 — AnimationMixer */
      if (gltf.animations.length > 0) {
        mixer  = new THREE.AnimationMixer(gltf.scene)
        action = mixer.clipAction(gltf.animations[0])
        action.play()
      }

      batReady = true

      /* Reduced-motion: single static frame at STORY[2] */
      if (reducedMotion) {
        const st = STORY[2]
        batGroup.position.set(...st.batPosition)
        batGroup.rotation.set(...st.batRotation, 'YXZ')
        batGroup.scale.setScalar(st.batScale * scaleMul)
        camera.position.set(...st.cameraPosition)
        camera.rotation.set(...st.cameraRotation, 'YXZ')
        moonLight.intensity = st.lightIntensity
        ;(scene.fog as THREE.FogExp2).density = st.fogDensity
        batMat.opacity = st.batOpacity
        renderer.render(scene, camera)
      }

    }, undefined, (err) => {
      console.error('BatFlyer: GLB load error —', err)
    })

    /* ── Camera lag state ── */
    let ccx  = STORY[0].cameraPosition[0]
    let ccy  = STORY[0].cameraPosition[1]
    let ccz  = STORY[0].cameraPosition[2]
    let ccrx = STORY[0].cameraRotation[0]
    let ccry = STORY[0].cameraRotation[1]
    let ccrz = STORY[0].cameraRotation[2]

    /* ── Final-section mouse-follow ─────────────────────────────────────────
       When #scene-signal ("Are you still here?") is in view the bat detaches
       from the scroll story and slowly follows the cursor instead.
       · finalBlend 0→1 ramps via lerp so the handoff is imperceptible
       · follow* vars chase the mouse target at a very slow 0.025 factor
       · Disabled on mobile (touch users have no mouse to follow)            */
    let isFinalSection = false
    let finalBlend     = 0
    /* Initialise to story[5] so there is no jump when blend starts */
    let followX  = STORY[5].batPosition[0]
    let followY  = STORY[5].batPosition[1]
    let followZ  = STORY[5].batPosition[2]
    let followRY = STORY[5].batRotation[1]
    let followRX = STORY[5].batRotation[0]

    const signalEl = document.getElementById('scene-signal')
    const signalObserver = new IntersectionObserver(
      ([entry]) => { isFinalSection = entry.isIntersecting },
      { threshold: 0.30 },
    )
    if (signalEl) signalObserver.observe(signalEl)

    /* ── Text tracking ── */
    let lastTextIdx = -1

    /* Reduced-motion exits before RAF */
    if (reducedMotion) {
      return () => {
        window.removeEventListener('resize', resize)
        batMat.dispose()
        renderer.dispose(); dracoLoader.dispose()
      }
    }

    /* ── Animation loop ─────────────────────────────────────────────────────── */
    let raf            = 0
    let accumulatedTime = 0
    let lastNow         = performance.now()
    const _sc           = document.getElementById('scroll-content')

    function animate(now: number) {
      raf = requestAnimationFrame(animate)

      const dt = Math.min((now - lastNow) / 1000, 0.05)
      lastNow          = now
      accumulatedTime += dt

      const scroll = Math.max(0, Math.min(1, scrollProgress.current))
      const kf     = sampleStory(scroll)

      /* ── Final-section blend ────────────────────────────────────────────────
         Ramp finalBlend toward 1 when the signal section is visible (desktop
         only), toward 0 otherwise.  0.035 factor ≈ 1.4 s to fully engage.  */
      const blendTarget = (!isMobile && isFinalSection) ? 1 : 0
      finalBlend = lerp(finalBlend, blendTarget, 0.035)

      /* Advance mouse-follow vars only while blend is non-trivial */
      if (finalBlend > 0.005) {
        const mx = mousePos.active ? (mousePos.x / window.innerWidth  - 0.5) * 2 : 0
        const my = mousePos.active ? (mousePos.y / window.innerHeight - 0.5) * 2 : 0
        /* Target position — centered, drawn toward mouse */
        const tX = THREE.MathUtils.clamp(mx  *  1.5, -1.6,  1.6)
        const tY = THREE.MathUtils.clamp(-my *  0.7 + 1.1,   0.2,  1.9)
        const tZ = -1.0   /* bring bat forward from Z=-3 so it is present */
        followX  = lerp(followX,  tX,         0.025)
        followY  = lerp(followY,  tY,         0.025)
        followZ  = lerp(followZ,  tZ,         0.018)
        /* Slight head/body rotation toward cursor */
        followRY = lerp(followRY, mx * 0.35,  0.035)
        followRX = lerp(followRX, -my * 0.18, 0.035)
      }

      /* ── AnimationMixer ── */
      if (mixer) {
        mixer.update(dt)
        /* Calm the wings further in the final section */
        const storyScale = 0.25 + kf.flapAmp * 0.45
        const calmScale  = 0.28
        if (action) action.timeScale = lerp(storyScale, calmScale, finalBlend)
      }

      /* ── Bat transform — story + procedural float + final-section blend ── */
      if (batReady) {
        const floatY    = Math.sin(accumulatedTime * 0.42) * 0.06
        const floatX    = Math.cos(accumulatedTime * 0.29) * 0.025
        const floatRoll = Math.sin(accumulatedTime * 0.35) * 0.018

        /* Blend between scroll-story position and mouse-follow position */
        const posX = lerp(kf.bx + floatX, followX, finalBlend)
        const posY = lerp(kf.by + floatY, followY, finalBlend)
        const posZ = lerp(kf.bz,          followZ, finalBlend)
        const rotY = lerp(kf.bry,         followRY, finalBlend)
        const rotX = lerp(kf.brx,         followRX, finalBlend)
        /* In the final section bring opacity up to fully visible */
        const opac = lerp(kf.batOpacity,  1.0,      finalBlend)

        batGroup.position.set(posX, posY, posZ)
        batGroup.rotation.set(rotX, rotY, kf.brz + floatRoll, 'YXZ')
        batGroup.scale.setScalar(kf.bScale * scaleMul)
        batMat.opacity = opac
      }

      /* ── Camera: cinematic lag + mouse parallax ── */
      const camF = 0.028
      ccx  = lerp(ccx,  kf.cx,  camF)
      ccy  = lerp(ccy,  kf.cy,  camF)
      ccz  = lerp(ccz,  kf.cz,  camF)
      ccrx = lerp(ccrx, kf.crx, camF)
      ccry = lerp(ccry, kf.cry, camF)
      ccrz = lerp(ccrz, kf.crz, camF)

      const mx = mousePos.active ? (mousePos.x / window.innerWidth  - 0.5) * 2 : 0
      const my = mousePos.active ? (mousePos.y / window.innerHeight - 0.5) * 2 : 0
      camera.position.set(ccx + mx * 0.06, ccy - my * 0.04, ccz)
      camera.rotation.set(ccrx, ccry, ccrz, 'YXZ')

      /* ── Scene globals ── */
      ;(scene.fog as THREE.FogExp2).density = kf.fogDensity
      moonLight.intensity = kf.lightIntensity

      /* Lights follow the blended bat position so they stay correct in both modes */
      const lx = lerp(kf.bx, followX, finalBlend)
      const ly = lerp(kf.by, followY, finalBlend)
      const lz = lerp(kf.bz, followZ, finalBlend)

      rimLight.position.set(lx - 0.5, ly + 0.8, lz - 1.8)
      rimLight.intensity = 6 + lerp(kf.batOpacity, 1.0, finalBlend) * 4

      accentLight.position.set(lx + 0.5, ly + 0.1, lz + 1.2)
      accentLight.intensity = lerp(kf.batOpacity, 1.0, finalBlend) * 3.5

      fillLight.position.y = lerp(fillLight.position.y, ly - 2.2, 0.04)

      /* ── Atmosphere overlay ── */
      const presence = THREE.MathUtils.clamp(
        kf.batOpacity * Math.max(0, (kf.bz + 1.2) / 2.8), 0, 1,
      )
      if (atmosphereRef.current) {
        atmosphereRef.current.style.opacity = (presence * 0.60).toFixed(3)
      }
      if (_sc) {
        _sc.style.filter = presence > 0.04
          ? `brightness(${(1 - presence * 0.14).toFixed(3)}) hue-rotate(${(presence * 9).toFixed(1)}deg)`
          : ''
      }

      /* ── Narrative text ── */
      const idx      = kf.storyIdx
      const segStart = STORY[idx].progress
      const segEnd   = idx < STORY.length - 1 ? STORY[idx + 1].progress : segStart + 0.001
      const localT   = Math.min(1, (scroll - segStart) / (segEnd - segStart))

      const textOp =
        localT < 0.20 ? localT / 0.20
        : localT < 0.80 ? 1
        : 1 - (localT - 0.80) / 0.20

      const textY =
        localT < 0.20 ? (1 - localT / 0.20) * 12
        : localT > 0.80 ? -((localT - 0.80) / 0.20) * 12
        : 0

      if (idx !== lastTextIdx) {
        lastTextIdx = idx
        if (textLabelRef.current) textLabelRef.current.textContent = `§ ${ROMAN[idx]}`
        if (textCopyRef.current)  textCopyRef.current.textContent  = STORY[idx].text
      }
      if (textWrapRef.current) {
        textWrapRef.current.style.opacity   = textOp.toFixed(3)
        textWrapRef.current.style.transform = `translateX(-50%) translateY(${textY.toFixed(1)}px)`
      }

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      if (signalEl) signalObserver.unobserve(signalEl)
      signalObserver.disconnect()
      if (_sc) _sc.style.filter = ''
      if (mixer) mixer.stopAllAction()
      batMat.dispose()
      renderer.dispose(); dracoLoader.dispose()
    }
  }, [])

  return (
    <>
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
            display: 'block', fontFamily: 'var(--font-body)',
            fontSize: '0.60rem', letterSpacing: '0.24em',
            color: 'rgba(169,159,255,0.50)', marginBottom: '0.7rem',
            textTransform: 'uppercase',
          }}
        >§ I</span>
        <span
          ref={textCopyRef}
          style={{
            display: 'block', fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.05rem, 2.6vw, 1.6rem)', fontWeight: 300,
            letterSpacing: '0.04em', color: 'rgba(228,222,255,0.85)',
            maxWidth: '36rem', lineHeight: 1.35,
          }}
        >When uncertainty begins</span>
      </div>
    </>
  )
}

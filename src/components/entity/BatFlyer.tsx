import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader }  from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { mousePos }           from '../../lib/mousePosition'

/* ── BatFlyer v4 ─────────────────────────────────────────────────────────────
   Real skeletal GLB bat — DRACO-compressed, 177-channel armature animation.
   GLB asset : /public/bat.glb   (104 KB, "Armature|Take 001|BaseLayer", 0.3 s)

   ARCHITECTURE
   ┌ batGroup          — world position/rotation/scale from scrollStory
   │  └ gltf.scene     — AnimationMixer drives all 61 bones
   └ particles         — 200 dust motes, trail the bat with soft lag

   CINEMATIC LAYERS
   · scrollStory       — 6 states interpolated by scroll (ease-in-out)
   · procedural float  — gentle sinusoidal drift layered on top
   · camera lag        — position + rotation follow story at factor 0.028
   · mouse parallax    — fine ±0.06 / ±0.04 camera nudge from cursor

   ANIMATION
   · AnimationMixer plays the embedded wing-flap loop continuously
   · action.timeScale  = 0.7 + flapAmp × 1.6  (slow glide → fast sprint)
   · batGroup rotation = story rotation  (cinematic heading changes)

   LIGHTING   · AmbientLight   — very dark blue-violet base
   · DirectionalLight — moonlight from upper left, intensity ∝ story
   · PointLight (rim) — violet, trails bat from behind
   · PointLight (fill)— warm amber from below, constant
   · PointLight (acc) — teal accent, follows bat, fades with batOpacity

   ATMOSPHERE
   · FogExp2           — density from story (0.008 to 0.025)
   · Overlay vignette  — violet, opacity ∝ bat presence
   · #scroll-content   — brightness + hue-rotate filter

   TEXT OVERLAY
   · Section label + narrative copy, updated via DOM refs (no re-renders)
   · Fade/slide envelope: 0-20 % in, 20-80 % hold, 80-100 % out

   FALLBACKS
   · Reduced-motion    — single static frame at STORY[2], no RAF
   · Mobile            — 0.65 × scale, 1.5 × DPR cap, no antialiasing
   · Load failure      — console.error, component stays invisible
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Story data ─────────────────────────────────────────────────────────────── */
interface StoryState {
  progress:       number
  batPosition:    [number, number, number]
  batRotation:    [number, number, number]   /* Euler YXZ */
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
  {
    progress: 0,
    batPosition: [0, 1, 4],  batRotation: [0, 0, 0],          batScale: 1.0,
    cameraPosition: [0, 0, 8], cameraRotation: [0, 0, 0],
    lightIntensity: 1.0, fogDensity: 0.020, flapAmp: 0.22, batOpacity: 0.0,
    text: 'When uncertainty begins',
  },
  {
    progress: 0.18,
    batPosition: [-2, 1.4, 2], batRotation: [0.2, -0.8, 0.1], batScale: 1.05,
    cameraPosition: [1, 0.5, 6], cameraRotation: [0.05, -0.15, 0],
    lightIntensity: 1.3, fogDensity: 0.025, flapAmp: 0.48, batOpacity: 1.0,
    text: 'We identify the risk',
  },
  {
    progress: 0.36,
    batPosition: [1.8, 0.8, 0], batRotation: [-0.1, 1.2, -0.2], batScale: 0.95,
    cameraPosition: [-1, 1, 5], cameraRotation: [0.1, 0.2, 0],
    lightIntensity: 1.6, fogDensity: 0.018, flapAmp: 0.60, batOpacity: 1.0,
    text: 'We build the strategy',
  },
  {
    progress: 0.56,
    batPosition: [0, 1.7, -1.5], batRotation: [0.3, 2.2, 0.15], batScale: 1.15,
    cameraPosition: [0, 1.4, 4.2], cameraRotation: [0.12, 0, 0],
    lightIntensity: 2.0, fogDensity: 0.012, flapAmp: 0.72, batOpacity: 1.0,
    text: 'We move with precision',
  },
  {
    progress: 0.76,
    batPosition: [-1.4, 1.1, -3], batRotation: [-0.2, 3.1, -0.1], batScale: 1.0,
    cameraPosition: [1.2, 0.8, 3.6], cameraRotation: [0.05, -0.25, 0],
    lightIntensity: 1.7, fogDensity: 0.015, flapAmp: 0.55, batOpacity: 1.0,
    text: 'Every detail matters',
  },
  {
    progress: 1,
    batPosition: [0, 1.2, -4.5], batRotation: [0, 6.28, 0], batScale: 1.2,
    cameraPosition: [0, 0.8, 3], cameraRotation: [0.05, 0, 0],
    lightIntensity: 2.4, fogDensity: 0.008, flapAmp: 0.40, batOpacity: 0.6,
    text: 'Your case. Our strategy.',
  },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

/* ── Interpolation ──────────────────────────────────────────────────────────── */
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

  if (scroll <= s[0].progress)                return fromState(s[0], 0)
  if (scroll >= s[s.length - 1].progress)     return fromState(s[s.length - 1], s.length - 1)

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
    lightIntensity: lerp(a.lightIntensity,  b.lightIntensity,  t),
    fogDensity:     lerp(a.fogDensity,      b.fogDensity,      t),
    flapAmp:        lerp(a.flapAmp,         b.flapAmp,         t),
    storyIdx: i,
  }
}

/* ── Particles config ───────────────────────────────────────────────────────── */
const N_PART = 200

/* ── Component ──────────────────────────────────────────────────────────────── */
export function BatFlyer() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const atmosphereRef = useRef<HTMLDivElement>(null)
  const textWrapRef   = useRef<HTMLDivElement>(null)
  const textLabelRef  = useRef<HTMLSpanElement>(null)
  const textCopyRef   = useRef<HTMLSpanElement>(null)
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
       1. Ambient       — very dark blue-violet, always on
       2. Moon (dir)    — cool blue-purple from upper left, intensity via story
       3. Rim (point)   — violet, trails bat from behind
       4. Fill (point)  — warm amber from below, atmospheric base
       5. Accent (point)— teal, follows bat from front, scales with opacity     */
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

    /* ── Bat material — replaces the GLB's default grey lambert1 ── */
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

    /* ── Bat group — receives story position/rotation/scale ── */
    const batGroup = new THREE.Group()
    scene.add(batGroup)

    /* ── Particle system ──────────────────────────────────────────────────────
       200 motes trailing the bat. Each has a fixed random offset that drifts
       slowly; the whole cloud follows batGroup position with a 0.05 lag.       */
    const partPositions = new Float32Array(N_PART * 3)
    const partOffsets: Array<{ ox: number; oy: number; oz: number; phase: number; speed: number }> = []
    for (let i = 0; i < N_PART; i++) {
      partOffsets.push({
        ox:    (Math.random() - 0.5) * 2.4,
        oy:    (Math.random() - 0.5) * 1.6,
        oz:    (Math.random() - 0.5) * 2.0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.18 + Math.random() * 0.32,
      })
      partPositions[i * 3]     = 0
      partPositions[i * 3 + 1] = 0
      partPositions[i * 3 + 2] = 0
    }
    const partGeo = new THREE.BufferGeometry()
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPositions, 3))
    const partMat = new THREE.PointsMaterial({
      size:         0.032,
      color:        new THREE.Color(0x9a8cff),
      transparent:  true,
      opacity:      0,
      depthWrite:   false,
      blending:     THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const particles = new THREE.Points(partGeo, partMat)
    scene.add(particles)

    /* ── GLB loading ─────────────────────────────────────────────────────────
       DRACO-compressed model — set decoder path to /draco/ (public folder).   */
    let batReady    = false
    let mixer:  THREE.AnimationMixer | null = null
    let action: THREE.AnimationAction | null = null
    let batMeshes:  Array<{ mat: THREE.MeshStandardMaterial }> = []

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')

    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load(
      '/bat.glb',
      (gltf) => {
        /* Apply custom material to every mesh */
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            mesh.material = batMat
            batMeshes.push({ mat: batMat })
          }
        })

        batGroup.add(gltf.scene)

        /* AnimationMixer — play the 0.3 s wing-flap loop */
        if (gltf.animations.length > 0) {
          mixer  = new THREE.AnimationMixer(gltf.scene)
          action = mixer.clipAction(gltf.animations[0])
          action.play()
        }

        batReady = true

        /* Reduced-motion: one static frame then stop */
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
      },
      undefined,
      (err) => { console.error('BatFlyer: GLB load failed —', err) },
    )

    /* ── Camera lag state ── */
    let ccx  = STORY[0].cameraPosition[0]
    let ccy  = STORY[0].cameraPosition[1]
    let ccz  = STORY[0].cameraPosition[2]
    let ccrx = STORY[0].cameraRotation[0]
    let ccry = STORY[0].cameraRotation[1]
    let ccrz = STORY[0].cameraRotation[2]

    /* ── Particle lag ── */
    let pcx = STORY[0].batPosition[0]
    let pcy = STORY[0].batPosition[1]
    let pcz = STORY[0].batPosition[2]

    /* ── Text tracking ── */
    let lastTextIdx = -1

    /* Reduced-motion path exits before RAF */
    if (reducedMotion) {
      return () => {
        window.removeEventListener('resize', resize)
        partGeo.dispose()
        partMat.dispose()
        batMat.dispose()
        renderer.dispose()
        dracoLoader.dispose()
      }
    }

    /* ── Animation loop ─────────────────────────────────────────────────────── */
    let raf:            number
    let accumulatedTime = 0
    let lastNow         = performance.now()

    const _scrollContent = document.getElementById('scroll-content')

    function animate(now: number) {
      raf = requestAnimationFrame(animate)

      const dt = Math.min((now - lastNow) / 1000, 0.05)
      lastNow          = now
      accumulatedTime += dt

      const scroll = Math.max(0, Math.min(1, scrollProgress.current))
      const kf     = sampleStory(scroll)

      /* ── AnimationMixer — speed proportional to flap intensity ── */
      if (mixer) {
        mixer.update(dt)
        if (action) action.timeScale = 0.7 + kf.flapAmp * 1.6
      }

      /* ── Bat: story position + procedural floating ── */
      if (batReady) {
        const floatY    = Math.sin(accumulatedTime * 0.42) * 0.06
        const floatX    = Math.cos(accumulatedTime * 0.29) * 0.025
        const floatRoll = Math.sin(accumulatedTime * 0.35) * 0.018

        batGroup.position.set(kf.bx + floatX, kf.by + floatY, kf.bz)
        batGroup.rotation.set(kf.brx, kf.bry, kf.brz + floatRoll, 'YXZ')
        batGroup.scale.setScalar(kf.bScale * scaleMul)

        /* Overall opacity */
        batMat.opacity = kf.batOpacity
      }

      /* ── Camera — cinematic lag + mouse parallax ── */
      const camF = 0.028
      ccx  = lerp(ccx,  kf.cx,  camF)
      ccy  = lerp(ccy,  kf.cy,  camF)
      ccz  = lerp(ccz,  kf.cz,  camF)
      ccrx = lerp(ccrx, kf.crx, camF)
      ccry = lerp(ccry, kf.cry, camF)
      ccrz = lerp(ccrz, kf.crz, camF)

      /* Mouse parallax — ±0.06 / ±0.04 on top of cinematic lag */
      const mx = mousePos.active ? (mousePos.x / window.innerWidth  - 0.5) * 2 : 0
      const my = mousePos.active ? (mousePos.y / window.innerHeight - 0.5) * 2 : 0
      camera.position.set(ccx + mx * 0.06, ccy - my * 0.04, ccz)
      camera.rotation.set(ccrx, ccry, ccrz, 'YXZ')

      /* ── Fog ── */
      ;(scene.fog as THREE.FogExp2).density = kf.fogDensity

      /* ── Lighting ── */
      moonLight.intensity = kf.lightIntensity
      rimLight.position.set(kf.bx - 0.5, kf.by + 0.9, kf.bz - 2.2)
      rimLight.intensity = 6 + kf.batOpacity * 4

      /* Accent light: teal front light, follows bat, fades with opacity */
      accentLight.position.set(kf.bx + 0.6, kf.by + 0.2, kf.bz + 1.4)
      accentLight.intensity = kf.batOpacity * 3.5

      /* Fill light: lerp vertically to stay below bat */
      fillLight.position.y = lerp(fillLight.position.y, kf.by - 2.2, 0.04)

      /* ── Particles ── */
      pcx = lerp(pcx, kf.bx, 0.05)
      pcy = lerp(pcy, kf.by, 0.05)
      pcz = lerp(pcz, kf.bz, 0.05)

      for (let i = 0; i < N_PART; i++) {
        const p = partOffsets[i]
        const t = accumulatedTime * p.speed + p.phase
        partPositions[i * 3]     = pcx + p.ox + Math.sin(t)              * 0.08
        partPositions[i * 3 + 1] = pcy + p.oy + Math.cos(t * 0.73)       * 0.05
        partPositions[i * 3 + 2] = pcz + p.oz + Math.sin(t * 0.51 + 1.2) * 0.07
      }
      partGeo.attributes.position.needsUpdate = true
      partMat.opacity = 0.28 * kf.batOpacity

      /* ── Atmosphere overlay ── */
      const presence = THREE.MathUtils.clamp(
        kf.batOpacity * Math.max(0, (kf.bz + 1.2) / 2.8), 0, 1,
      )
      if (atmosphereRef.current) {
        atmosphereRef.current.style.opacity = (presence * 0.60).toFixed(3)
      }

      /* ── Scroll-content filter ── */
      if (_scrollContent) {
        if (presence > 0.04) {
          _scrollContent.style.filter =
            `brightness(${(1 - presence * 0.14).toFixed(3)}) hue-rotate(${(presence * 9).toFixed(1)}deg)`
        } else {
          _scrollContent.style.filter = ''
        }
      }

      /* ── Narrative text ────────────────────────────────────────────────────
         Fade/slide envelope per segment: 20 % in / 60 % hold / 20 % out.     */
      const idx      = kf.storyIdx
      const segStart = STORY[idx].progress
      const segEnd   = idx < STORY.length - 1 ? STORY[idx + 1].progress : segStart + 0.001
      const localT   = Math.min(1, (scroll - segStart) / (segEnd - segStart))

      const textOpacity =
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
      if (mixer) mixer.stopAllAction()
      partGeo.dispose()
      partMat.dispose()
      batMat.dispose()
      renderer.dispose()
      dracoLoader.dispose()
    }
  }, [])

  return (
    <>
      {/* WebGL canvas */}
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

      {/* Violet vignette — blooms with bat proximity */}
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

      {/* Narrative text overlay */}
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

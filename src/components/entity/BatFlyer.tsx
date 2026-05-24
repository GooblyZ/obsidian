import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useScrollProgress } from '../../hooks/useScrollProgress'

/* ── BatFlyer ────────────────────────────────────────────────────────────────
   A 3-D bat built entirely from Three.js primitives — no external model.

   Anatomy:
     · Body    — flattened SphereGeometry
     · Head    — smaller sphere positioned forward
     · Ears    — ConeGeometry × 2
     · Wings   — ShapeGeometry (bezier membrane outline), one per side,
                 parented to pivot groups for flap rotation

   Motion:
     · CatmullRomCurve3 defines a looping flight path across the full page
     · scroll progress (0 → 1) drives position along the curve
     · bat.quaternion aligns the body to the tangent of the path
     · rotateZ after lookAt adds a banking roll into turns
     · Wing pivots oscillate on z-axis: a slow, weighty flap

   Two separate WebGL renderers (bat + particle canvas) is fine — browsers
   support ≥16 WebGL contexts. The bat renderer is antialias: true so the
   wing edges stay crisp on high-DPI screens.
   ─────────────────────────────────────────────────────────────────────────── */

export function BatFlyer() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
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
    const ambient = new THREE.AmbientLight(0x110820, 1.2)
    scene.add(ambient)

    /* Point light moves with the bat — keeps it self-lit wherever it flies */
    const fillLight = new THREE.PointLight(0x5535cc, 4.5, 12)
    fillLight.position.set(0, 1, 3)
    scene.add(fillLight)

    /* ── Materials ── */
    const bodyMat = new THREE.MeshPhongMaterial({
      color:              new THREE.Color(0x0c0a1c),
      emissive:           new THREE.Color(0x2a1260),
      emissiveIntensity:  0.55,
      shininess:          80,
    })
    const wingMat = new THREE.MeshPhongMaterial({
      color:              new THREE.Color(0x080612),
      emissive:           new THREE.Color(0x1c0d50),
      emissiveIntensity:  0.50,
      shininess:          30,
      side:               THREE.DoubleSide,
      transparent:        true,
      opacity:            0.92,
    })

    /* ── Bat group ── */
    const bat = new THREE.Group()
    scene.add(bat)

    /* Body — flattened oval */
    const bodyGeo = new THREE.SphereGeometry(0.09, 12, 8)
    bodyGeo.scale(1, 0.88, 1.85)
    bat.add(new THREE.Mesh(bodyGeo, bodyMat))

    /* Head */
    const headGeo = new THREE.SphereGeometry(0.076, 12, 8)
    const headMesh = new THREE.Mesh(headGeo, bodyMat)
    headMesh.position.set(0, 0.022, 0.19)
    bat.add(headMesh)

    /* Ears × 2 */
    const earGeos: THREE.ConeGeometry[] = []
    ;([-1, 1] as const).forEach((side) => {
      const earGeo = new THREE.ConeGeometry(0.025, 0.082, 4)
      earGeos.push(earGeo)
      const ear = new THREE.Mesh(earGeo, bodyMat)
      ear.position.set(side * 0.048, 0.094, 0.19)
      ear.rotation.z = side * 0.24
      ear.rotation.x = -0.12
      bat.add(ear)
    })

    /* Wing membrane outline — smooth bezier, right-hand side
       Root at origin; membrane extends in +x, spans roughly 0.8 world units  */
    function makeMembrane(): THREE.Shape {
      const s = new THREE.Shape()
      s.moveTo(0, 0)
      /* Leading edge — arm curving forward */
      s.bezierCurveTo(0.16, 0.065, 0.44, 0.135, 0.76, 0.045)
      /* Wingtip — narrow point */
      s.bezierCurveTo(0.82, 0.020, 0.84, -0.020, 0.80, -0.060)
      /* Trailing edge — curves back toward body */
      s.bezierCurveTo(0.66, -0.200, 0.40, -0.250, 0.20, -0.220)
      s.bezierCurveTo(0.08, -0.150, 0.02, -0.065, 0, 0)
      return s
    }

    /* Right wing */
    const rwGeo   = new THREE.ShapeGeometry(makeMembrane(), 12)
    const rPivot  = new THREE.Group()
    rPivot.position.set(0.055, 0, 0)
    rPivot.add(new THREE.Mesh(rwGeo, wingMat))
    bat.add(rPivot)

    /* Left wing — identical geometry, mirrored on x */
    const lwGeo  = new THREE.ShapeGeometry(makeMembrane(), 12)
    const lPivot = new THREE.Group()
    lPivot.position.set(-0.055, 0, 0)
    lPivot.scale.x = -1   /* mirror: positive-x wing now extends left */
    lPivot.add(new THREE.Mesh(lwGeo, wingMat))
    bat.add(lPivot)

    /* ── Flight path ─────────────────────────────────────────────────────────
       18 control points mapped to scroll 0 → 1.
       The bat makes three passes across the viewport, going off-screen between
       them. Values are in camera-world units; at z = 0 the visible range is
       roughly x: ±5.7 y: ±3.2 (at 16:9 with FOV 65 and camera at z = 5).    */
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( -8.0,  0.2,  0.0),   /* 0  — entry left, hidden       */
      new THREE.Vector3( -2.8,  0.5,  0.2),   /* 1  — entering from left       */
      new THREE.Vector3( -0.5,  0.75, 0.3),   /* 2  — center-left, high        */
      new THREE.Vector3(  1.2,  0.10, 0.2),   /* 3  — crossing center          */
      new THREE.Vector3(  3.2, -0.45, 0.1),   /* 4  — right side, dipping      */
      new THREE.Vector3(  7.5, -1.0,  0.0),   /* 5  — exit right               */
      new THREE.Vector3(  8.5, -2.2, -0.2),   /* 6  — off-screen               */
      new THREE.Vector3(  5.0, -1.9,  0.1),   /* 7  — arc back                 */
      new THREE.Vector3(  1.8, -0.6,  0.3),   /* 8  — re-entry center-right    */
      new THREE.Vector3( -0.3,  0.2,  0.4),   /* 9  — crossing center          */
      new THREE.Vector3( -2.0,  0.9,  0.3),   /* 10 — left-center, rising      */
      new THREE.Vector3( -4.5,  1.4,  0.1),   /* 11 — upper left               */
      new THREE.Vector3( -8.5,  1.9,  0.0),   /* 12 — off-screen upper left    */
      new THREE.Vector3( -5.5,  0.8,  0.2),   /* 13 — third entry sweep        */
      new THREE.Vector3( -1.8,  0.3,  0.3),   /* 14 — center-left              */
      new THREE.Vector3(  0.6, -0.5,  0.4),   /* 15 — low center               */
      new THREE.Vector3(  3.0,  0.7,  0.2),   /* 16 — right side, rising       */
      new THREE.Vector3(  7.5,  1.5,  0.0),   /* 17 — exit upper right         */
    ], false, 'catmullrom', 0.5)

    /* ── Animation loop ── */
    /* Pre-allocate — no per-frame GC */
    const _p    = new THREE.Vector3()
    const _p2   = new THREE.Vector3()
    const _dir  = new THREE.Vector3()
    const _fwd  = new THREE.Vector3(0, 0, -1)   /* default Three.js forward */
    const _quat = new THREE.Quaternion()

    let raf: number

    function animate(now: number) {
      raf = requestAnimationFrame(animate)

      const t = Math.max(0.0001, Math.min(0.9999, scrollProgress.current))

      /* Position along curve */
      curve.getPointAt(t, _p)
      bat.position.copy(_p)

      /* Orientation — local -Z aligned to direction of travel */
      curve.getPointAt(Math.min(t + 0.008, 0.9999), _p2)
      _dir.subVectors(_p2, _p).normalize()
      _quat.setFromUnitVectors(_fwd, _dir)
      bat.quaternion.copy(_quat)

      /* Banking roll — tilt into horizontal turns */
      bat.rotateZ(-_dir.x * 0.52)

      /* Wing flap — continuous, both wings synchronized
         Frequency ≈ 0.88 Hz (one full beat per ~1.1 s) — weighty, purposeful */
      const flap = Math.sin(now * 0.0055) * 0.60
      rPivot.rotation.z =  flap
      lPivot.rotation.z = -flap   /* scale.x = -1 makes this a real mirror     */

      /* Point light tracks bat */
      fillLight.position.set(_p.x * 0.3, _p.y * 0.3 + 0.85, 3.2)

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ;[bodyGeo, headGeo, rwGeo, lwGeo, ...earGeos].forEach((g) => g.dispose())
      bodyMat.dispose()
      wingMat.dispose()
      renderer.dispose()
    }
  }, [])

  return (
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
  )
}

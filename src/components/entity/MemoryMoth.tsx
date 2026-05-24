import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { mousePos } from '../../lib/mousePosition'

/* Memory Moth — OBSIDIAN's guide entity.
   A geometric fragment of digital consciousness: three points of light in a
   perpetual triangular orbit. Gold core. Faint wing traces.

   Follows the cursor with heavy lag (lerp 0.06) — it's been attracted to the
   user, not controlled by them. Appears 2.2s after mount, after the preloader
   clears. mix-blend-mode: screen means only its light survives — dark pixels
   are transparent against whatever is beneath.                                */

export function MemoryMoth() {
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    /* Entrance — wait for preloader */
    gsap.set(el, { opacity: 0 })
    gsap.to(el, { opacity: 1, duration: 1.6, delay: 2.2, ease: 'power2.out' })

    /* Lerped position tracking */
    let lx = window.innerWidth  * 0.82
    let ly = window.innerHeight * 0.22
    let tx = lx, ty = ly

    let raf: number
    function track() {
      raf = requestAnimationFrame(track)
      if (mousePos.active) {
        /* Center the 60×60 moth on the cursor */
        tx = mousePos.x - 30
        ty = mousePos.y - 30
      }
      /* Heavy lag — ~10 frames to halve the gap */
      lx += (tx - lx) * 0.062
      ly += (ty - ly) * 0.062
      gsap.set(el, { x: lx, y: ly })
    }
    track()

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={elRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        zIndex:        9,
        pointerEvents: 'none',
        width:         60,
        height:        60,
        willChange:    'transform',
        mixBlendMode:  'screen',
      }}
    >
      <svg
        width="60" height="60" viewBox="0 0 60 60"
        fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* Wing traces — barely visible arcs suggesting form */}
        <path
          d="M30 30 Q8 20 12 8 Q20 1 30 14"
          stroke="rgba(169,159,255,0.11)"
          strokeWidth="0.7"
          fill="none"
        />
        <path
          d="M30 30 Q52 20 48 8 Q40 1 30 14"
          stroke="rgba(169,159,255,0.11)"
          strokeWidth="0.7"
          fill="none"
        />

        {/* Orbit ring — structural guide, nearly invisible */}
        <circle
          cx="30" cy="30" r="14"
          stroke="rgba(124,111,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Orbiting point A — violet, primary */}
        <g style={{ transformOrigin: '30px 30px', animation: 'mothA 5.2s linear infinite' }}>
          <circle cx="30" cy="16" r="2.4" fill="rgba(169,159,255,0.88)" />
        </g>

        {/* Orbiting point B — teal, counter-rotate */}
        <g style={{ transformOrigin: '30px 30px', animation: 'mothA 7.9s linear infinite reverse' }}>
          <circle cx="44" cy="37" r="1.7" fill="rgba(45,212,191,0.68)" />
        </g>

        {/* Orbiting point C — gold, slow drift */}
        <g style={{ transformOrigin: '30px 30px', animation: 'mothA 12.4s linear infinite' }}>
          <circle cx="16" cy="37" r="1.7" fill="rgba(212,175,122,0.68)" />
        </g>

        {/* Central anchor — soft gold core, pulses in opacity */}
        <circle
          cx="30" cy="30" r="1.3"
          fill="rgba(212,175,122,0.95)"
          style={{ animation: 'mothCore 3.8s ease-in-out infinite' }}
        />
      </svg>

      <style>{`
        @keyframes mothA {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes mothCore {
          0%, 100% { opacity: 0.95; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

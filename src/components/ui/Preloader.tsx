import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'

/* Preloader — a full-viewport black cover that fades out on mount.
   Like a projector warming up before the frame appears.
   Duration: 1.4s hold → 0.9s fade.                                         */
export function Preloader() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    /* Brief hold at full black, then sweep away upward */
    gsap.to(el, {
      opacity: 0,
      duration: 0.9,
      delay: 1.1,
      ease: 'power2.inOut',
      onComplete() { el.style.display = 'none' },
    })
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: '#06080d',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Subtle pulsing center dot while waiting */}
      <div style={{
        width: '4px', height: '4px',
        borderRadius: '50%',
        background: 'rgba(124,111,255,0.5)',
        animation: 'preloaderPulse 0.9s ease-in-out infinite',
      }} />

      <style>{`
        @keyframes preloaderPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50%       { transform: scale(2); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

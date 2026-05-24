import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Scene 03 — BREATH
   A single word floats alone at center screen.
   One pulsing point of light above it — a signal in the dark.
   This is structural silence: the gap between thought and memory. */
export function BreathScene() {
  const wordRef  = useRef<HTMLSpanElement>(null)
  const dotRef   = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set([wordRef.current, dotRef.current], { opacity: 0 })

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 60%',
        end: 'bottom 40%',
        toggleActions: 'play reverse play reverse',
        onEnter() {
          gsap.to(dotRef.current,  { opacity: 1, duration: 1.4, ease: 'power2.out' })
          gsap.to(wordRef.current, { opacity: 0.22, duration: 2, ease: 'power2.out', delay: 0.4 })
        },
        onLeave() {
          gsap.to([dotRef.current, wordRef.current], { opacity: 0, duration: 1, ease: 'power2.in' })
        },
        onEnterBack() {
          gsap.to(dotRef.current,  { opacity: 1, duration: 1.4, ease: 'power2.out' })
          gsap.to(wordRef.current, { opacity: 0.22, duration: 2, ease: 'power2.out', delay: 0.4 })
        },
        onLeaveBack() {
          gsap.to([dotRef.current, wordRef.current], { opacity: 0, duration: 1, ease: 'power2.in' })
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="scene-breath"
      ref={sectionRef}
      aria-hidden="true"
      style={{
        minHeight: '80dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        position: 'relative',
      }}
    >
      {/* Pulsing point of light */}
      <div
        ref={dotRef}
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'var(--color-violet-bright)',
          boxShadow: '0 0 16px 4px rgba(169,159,255,0.5)',
          animation: 'breathPulse 3.2s ease-in-out infinite',
        }}
      />

      <span ref={wordRef} className="display-md em" style={{ userSelect: 'none' }}>
        stillness
      </span>

      <style>{`
        @keyframes breathPulse {
          0%, 100% { transform: scale(1);   box-shadow: 0 0 12px 3px rgba(169,159,255,0.4); }
          50%       { transform: scale(1.5); box-shadow: 0 0 28px 8px rgba(169,159,255,0.6); }
        }
      `}</style>
    </section>
  )
}

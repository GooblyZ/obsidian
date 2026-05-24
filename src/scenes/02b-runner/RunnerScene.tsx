import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Scene 02b — RUNNER
   A pinned viewport where a long phrase scrolls horizontally
   as the user scrolls vertically — like a ticker tape in the dark.
   The phrase bleeds past viewport edges, Noomo-style.
   This is the kinetic moment between Fragment and Breath.               */

const PHRASE = 'The archive remembers · every frequency · every wavelength · every moment of transmission ·'
const REPEATED = `${PHRASE}  ${PHRASE}  ${PHRASE}`

export function RunnerScene() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const track   = trackRef.current
    if (!section || !track) return

    /* Start track far right, end at far left — motion tied to scroll */
    gsap.set(track, { x: '30vw' })

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.4,
        onUpdate(self) {
          /* Map 0→1 progress to 30vw→-120vw horizontal travel */
          const x = 30 - self.progress * 150
          gsap.set(track, { x: `${x}vw` })
        },
      })

      /* Fade in phrase as section enters */
      gsap.set(track, { opacity: 0 })
      ScrollTrigger.create({
        trigger: section,
        start: 'top 80%',
        onEnter() { gsap.to(track, { opacity: 1, duration: 1.2, ease: 'power2.out' }) },
        onLeaveBack() { gsap.to(track, { opacity: 0, duration: 0.6 }) },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      style={{
        minHeight: '80dvh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        ref={trackRef}
        aria-hidden="true"
        style={{
          whiteSpace: 'nowrap',
          userSelect: 'none',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 5.5vw, 6vw)',
          fontWeight: 300,
          letterSpacing: '-0.01em',
          color: 'var(--color-text-dim)',
          lineHeight: 1,
          opacity: 0,
        }}
      >
        {REPEATED}
      </div>
    </section>
  )
}

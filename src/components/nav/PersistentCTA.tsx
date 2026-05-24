import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Persistent CTA — appears bottom-right once user scrolls past the hero.
   Clicking returns to origin. Styled as a glass pill. */
export function PersistentCTA() {
  const ref     = useRef<HTMLDivElement>(null)
  const trigRef = useRef<ReturnType<typeof ScrollTrigger.create> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    trigRef.current = ScrollTrigger.create({
      trigger: '#scene-hero',
      start: 'bottom 60%',
      onEnter:     () => el.classList.add('visible'),
      onLeaveBack: () => el.classList.remove('visible'),
    })

    return () => trigRef.current?.kill()
  }, [])

  function scrollToTop() {
    gsap.to(window, { scrollTo: 0, duration: 2.2, ease: 'power3.inOut' })
  }

  return (
    <div ref={ref} className="persistent-cta">
      <button onClick={scrollToTop} aria-label="Return to top">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <path d="M4 7V1M1 4l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Origin
      </button>
    </div>
  )
}

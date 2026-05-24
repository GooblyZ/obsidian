import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* SweepLine — an iridescent horizontal rule that sweeps left→right
   as it enters the viewport. Placed between scenes as a breath marker.
   scaleX starts at 0 (origin: left), sweeps to 1 on scroll entry.        */
interface Props {
  delay?: number
  color?: 'violet' | 'teal' | 'gold'
}

const GRADIENTS = {
  violet: 'linear-gradient(90deg, transparent 0%, rgba(124,111,255,0.5) 40%, rgba(169,159,255,0.7) 60%, transparent 100%)',
  teal:   'linear-gradient(90deg, transparent 0%, rgba(45,212,191,0.4) 40%, rgba(45,212,191,0.6) 60%, transparent 100%)',
  gold:   'linear-gradient(90deg, transparent 0%, rgba(212,175,122,0.4) 40%, rgba(212,175,122,0.6) 60%, transparent 100%)',
}

export function SweepLine({ delay = 0, color = 'violet' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    gsap.set(el, { scaleX: 0, transformOrigin: 'left center' })

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter() {
        gsap.to(el, { scaleX: 1, duration: 1.4, ease: 'power3.inOut', delay })
      },
      onLeaveBack() {
        gsap.to(el, { scaleX: 0, duration: 0.6, ease: 'power2.in' })
      },
    })

    return () => trigger.kill()
  }, [delay])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        height: '1px',
        width: '100%',
        background: GRADIENTS[color],
        margin: '0 auto',
      }}
    />
  )
}

import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Floating depth fragments — 8 tiny diamond shapes scattered across the page.
   Each parallaxes at a different rate, creating depth between the WebGL canvas
   (z-layer 0) and the text content (z-layer 1).

   Near fragments (large travel) appear closest — they move fastest relative to
   content. Far fragments (small travel) barely move, receding into the canvas.

   Positioned at absolute scroll depths across the ~840dvh full page height.   */

const SHARDS = [
  { top:  '10dvh', left:  '7%',  size: 6, opacity: 0.055, travel: 170, color: '#7c6fff' },
  { top:  '80dvh', left: '88%',  size: 4, opacity: 0.048, travel: 230, color: '#2dd4bf' },
  { top: '190dvh', left:  '5%',  size: 5, opacity: 0.058, travel: 105, color: '#7c6fff' },
  { top: '290dvh', left: '83%',  size: 6, opacity: 0.044, travel: 185, color: '#d4af7a' },
  { top: '380dvh', left: '12%',  size: 4, opacity: 0.052, travel: 250, color: '#2dd4bf' },
  { top: '480dvh', left: '76%',  size: 5, opacity: 0.048, travel: 135, color: '#7c6fff' },
  { top: '590dvh', left: '91%',  size: 7, opacity: 0.038, travel: 155, color: '#d4af7a' },
  { top: '710dvh', left: '39%',  size: 4, opacity: 0.062, travel: 290, color: '#2dd4bf' },
] as const

export function FloatingFragments() {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /* Set initial diamond rotation via GSAP so subsequent y updates compose */
    refs.current.forEach((el) => {
      if (el) gsap.set(el, { rotation: 45 })
    })

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger:      document.documentElement,
        start:        'top top',
        end:          'bottom bottom',
        scrub:        1,
        onUpdate(self) {
          refs.current.forEach((el, i) => {
            if (!el) return
            /* Negative y: fragment moves up as page scrolls — near = more movement */
            gsap.set(el, { y: -self.progress * SHARDS[i].travel })
          })
        },
      })
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      {SHARDS.map((shard, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el }}
          style={{
            position:   'absolute',
            top:        shard.top,
            left:       shard.left,
            width:      `${shard.size}px`,
            height:     `${shard.size}px`,
            background: shard.color,
            opacity:    shard.opacity,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  )
}

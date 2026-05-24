import { useEffect, useRef } from 'react'
import { ScrollTrigger } from '../../lib/gsap'

/* AmbientGradient — a fixed radial overlay that slowly shifts hue with scroll.
   Adds color temperature change across the narrative without WebGL overhead.

   Hue arc:
     0%   → violet/indigo at top   (void)
     40%  → violet bleeds downward (fragment)
     70%  → teal warmth rises      (archive)
     100% → gold warmth fills      (signal)                                  */
export function AmbientGradient() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const stops = [
      {
        at: 0,
        top:    'radial-gradient(ellipse 80% 45% at 50% -5%,  rgba(124,111,255,0.07) 0%, transparent 70%)',
        bottom: 'radial-gradient(ellipse 70% 35% at 50% 110%, rgba(74,64,200,0.04) 0%, transparent 65%)',
      },
      {
        at: 0.4,
        top:    'radial-gradient(ellipse 80% 45% at 50% -5%,  rgba(124,111,255,0.05) 0%, transparent 70%)',
        bottom: 'radial-gradient(ellipse 70% 35% at 50% 110%, rgba(45,212,191,0.05) 0%, transparent 65%)',
      },
      {
        at: 0.7,
        top:    'radial-gradient(ellipse 80% 45% at 50% -5%,  rgba(45,212,191,0.04) 0%, transparent 70%)',
        bottom: 'radial-gradient(ellipse 70% 35% at 50% 110%, rgba(212,175,122,0.07) 0%, transparent 65%)',
      },
      {
        at: 1.0,
        top:    'radial-gradient(ellipse 80% 45% at 50% -5%,  rgba(45,212,191,0.02) 0%, transparent 70%)',
        bottom: 'radial-gradient(ellipse 70% 40% at 50% 110%, rgba(212,175,122,0.11) 0%, transparent 60%)',
      },
    ]

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

    function parseRgba(grad: string) {
      const match = grad.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/)
      if (!match) return [0, 0, 0, 0]
      return [+match[1], +match[2], +match[3], +match[4]]
    }

    function buildGradient(template: string, r: number, g: number, b: number, a: number) {
      return template.replace(/rgba\(\d+,\d+,\d+,[\d.]+\)/, `rgba(${r|0},${g|0},${b|0},${a.toFixed(3)})`)
    }

    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const p = self.progress

        for (let i = 0; i < stops.length - 1; i++) {
          const a = stops[i], b = stops[i + 1]
          if (p >= a.at && p <= b.at) {
            const t = (p - a.at) / (b.at - a.at)

            const [r1, g1, b1, a1] = parseRgba(a.top)
            const [r2, g2, b2, a2] = parseRgba(b.top)
            const top = buildGradient(a.top,
              lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t), lerp(a1, a2, t))

            const [r3, g3, b3, a3] = parseRgba(a.bottom)
            const [r4, g4, b4, a4] = parseRgba(b.bottom)
            const bot = buildGradient(a.bottom,
              lerp(r3, r4, t), lerp(g3, g4, t), lerp(b3, b4, t), lerp(a3, a4, t))

            el.style.background = `${top}, ${bot}`
            break
          }
        }
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 45% at 50% -5%, rgba(124,111,255,0.07) 0%, transparent 70%)',
        transition: 'background 0.8s ease',
      }}
    />
  )
}

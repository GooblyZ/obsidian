import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Scene 02 — FRAGMENT
   Three weighted statements surface word by word.
   Each carries a gold italic anchor — the emotional nucleus of the line.
   Silence between lines is structural: 16vh of empty breathing room.

   Interaction — magnetic em words:
     On cursor proximity (radius 110px), the em word drifts away on the x-axis.
     Only x is used — y is claimed by the reveal animation. The displacement is
     subtle (max ±14px) but makes the words feel physically present.           */

const LINES: Array<{ prefix: string[]; em: string; suffix: string[] }> = [
  {
    prefix:  ['What'],
    em:      'remains',
    suffix:  ['after', 'the', 'signal', 'fades.'],
  },
  {
    prefix:  ['The'],
    em:      'archive',
    suffix:  ['does', 'not', 'forget.'],
  },
  {
    prefix:  ['You', 'were'],
    em:      'here',
    suffix:  ['.'],
  },
]

export function FragmentScene() {
  const sectionRef = useRef<HTMLElement>(null)
  const lineRefs   = useRef<(HTMLParagraphElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    /* ── Reveal animations ── */
    const ctx = gsap.context(() => {
      lineRefs.current.forEach((line) => {
        if (!line) return
        const words = Array.from(line.querySelectorAll<HTMLSpanElement>('[data-word]'))
        gsap.set(words, { opacity: 0, y: 30 })

        ScrollTrigger.create({
          trigger: line,
          start: 'top 78%',
          end: 'top 20%',
          toggleActions: 'play none none reverse',
          onEnter() {
            gsap.to(words, {
              opacity: 1, y: 0,
              duration: 1.15, stagger: 0.1, ease: 'power3.out',
            })
            /* Em word gets a delayed gold glow after surfacing */
            const emSpan = line.querySelector<HTMLElement>('.em')
            if (emSpan) {
              gsap.fromTo(emSpan,
                { textShadow: '0 0 0px rgba(212,175,122,0)' },
                { textShadow: '0 0 36px rgba(212,175,122,0.32), 0 0 72px rgba(212,175,122,0.12)',
                  duration: 1.8, delay: 0.9, ease: 'power2.out' }
              )
            }
          },
          onLeaveBack() {
            gsap.to(words, { opacity: 0, y: 30, duration: 0.5, stagger: 0.03 })
          },
        })
      })
    }, sectionRef)

    /* ── Magnetic em words ──────────────────────────────────────────────────
       Cursor proximity pushes each .em span along the x-axis only.
       quickTo batches the animation frames — safe to call on every mousemove. */
    const emEls = Array.from(section.querySelectorAll<HTMLElement>('.em'))
    const quickX = emEls.map((el) =>
      gsap.quickTo(el, 'x', { duration: 0.65, ease: 'power3.out' })
    )

    const RADIUS  = 110   /* px — influence radius                */
    const MAX_PX  = 14    /* px — maximum horizontal displacement */

    function onMouseMove(e: MouseEvent) {
      emEls.forEach((el, i) => {
        const rect  = el.getBoundingClientRect()
        const cx    = rect.left + rect.width  / 2
        const cy    = rect.top  + rect.height / 2
        const dx    = e.clientX - cx
        const dy    = e.clientY - cy
        const dist  = Math.sqrt(dx * dx + dy * dy)

        if (dist < RADIUS && dist > 0.01) {
          /* Push: word moves away from cursor on x axis */
          const push = -(dx / dist) * (1 - dist / RADIUS) * MAX_PX
          quickX[i](push)
        } else {
          quickX[i](0)
        }
      })
    }

    section.addEventListener('mousemove', onMouseMove)

    return () => {
      ctx.revert()
      section.removeEventListener('mousemove', onMouseMove)
      /* Reset x transforms so words sit correctly if component remounts */
      emEls.forEach((el) => gsap.set(el, { x: 0 }))
    }
  }, [])

  return (
    <section
      id="scene-fragment"
      ref={sectionRef}
      style={{ minHeight: '260dvh', position: 'relative', padding: '20vh 10vw' }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', gap: '18vh', paddingTop: '15vh',
      }}>
        {LINES.map((line, i) => (
          <p
            key={i}
            ref={(el) => { lineRefs.current[i] = el }}
            className="display-lg"
            style={{ maxWidth: '88vw' }}
          >
            {line.prefix.map((w, j) => (
              <span key={`p${j}`} data-word className="inline-block" style={{ marginRight: '0.22em' }}>{w}</span>
            ))}
            <span data-word className="em inline-block" style={{ marginRight: '0.22em' }}>{line.em}</span>
            {line.suffix.map((w, j) => (
              <span key={`s${j}`} data-word className="inline-block" style={{ marginRight: '0.22em' }}>{w}</span>
            ))}
          </p>
        ))}
      </div>
    </section>
  )
}

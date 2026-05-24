import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'
import { typewrite } from '../../lib/typewriter'

/* Scene 04 — ARCHIVE
   Memory fragments surface from alternating directions.
   Header fades in first. Each card slides from left/right.
   The body text types itself out as the card enters — character by character.
   Gold em marker on the final fragment. */

const FRAGMENTS = [
  {
    id: '001',
    timestamp: '2047 · 03 · 12',
    text: 'She said the color of memory is not black. It is the deep violet before a storm breaks.',
    align: 'left' as const,
  },
  {
    id: '002',
    timestamp: '2047 · 08 · 29',
    text: 'The signal was brief. Seventeen milliseconds. Long enough to know something was listening.',
    align: 'right' as const,
  },
  {
    id: '003',
    timestamp: '2048 · 01 · 01',
    text: 'I archived the last fragment at midnight. The machine kept running. I did not.',
    align: 'left' as const,
  },
]

export function ArchiveScene() {
  const sectionRef  = useRef<HTMLElement>(null)
  const headerRef   = useRef<HTMLDivElement>(null)
  const cardRefs    = useRef<(HTMLDivElement | null)[]>([])
  const textRefs    = useRef<(HTMLParagraphElement | null)[]>([])
  const cleanupFns  = useRef<(() => void)[]>([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      /* Header */
      if (headerRef.current) {
        gsap.set(headerRef.current, { opacity: 0, y: 18 })
        ScrollTrigger.create({
          trigger: headerRef.current,
          start: 'top 82%',
          onEnter()    { gsap.to(headerRef.current, { opacity: 1, y: 0, duration: 1.2 }) },
          onLeaveBack(){ gsap.to(headerRef.current, { opacity: 0, y: 18, duration: 0.55 }) },
        })
      }

      /* Fragment cards */
      cardRefs.current.forEach((card, i) => {
        if (!card) return
        const textEl = textRefs.current[i]
        const xFrom  = FRAGMENTS[i].align === 'left' ? -52 : 52

        gsap.set(card, { opacity: 0, x: xFrom })
        if (textEl) {
          textEl.textContent = ''
          textEl.style.visibility = 'hidden'
        }

        ScrollTrigger.create({
          trigger: card,
          start: 'top 80%',
          onEnter() {
            gsap.to(card, {
              opacity: 1, x: 0,
              duration: 1.3, ease: 'power3.out',
              delay: i * 0.05,
              onComplete() {
                if (!textEl) return
                textEl.style.visibility = 'visible'
                const fn = typewrite(textEl, FRAGMENTS[i].text, 1600)
                cleanupFns.current[i] = fn
              },
            })
          },
          onLeaveBack() {
            cleanupFns.current[i]?.()
            if (textEl) {
              textEl.textContent = ''
              textEl.style.visibility = 'hidden'
            }
            gsap.to(card, { opacity: 0, x: xFrom, duration: 0.5 })
          },
        })
      })
    }, sectionRef)

    return () => {
      cleanupFns.current.forEach(fn => fn?.())
      ctx.revert()
    }
  }, [])

  return (
    <section
      id="scene-archive"
      ref={sectionRef}
      style={{
        minHeight: '100dvh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14vh 1.5rem 14vh',
        gap: '5rem',
      }}
    >
      {/* Label */}
      <div
        ref={headerRef}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
      >
        <p className="caption" style={{ letterSpacing: '0.18em' }}>Memory Archive</p>
        <div className="rule-obsidian" style={{ width: '5rem' }} />
      </div>

      {/* Cards */}
      <div style={{ width: '100%', maxWidth: '44rem', display: 'flex', flexDirection: 'column', gap: '5rem' }}>
        {FRAGMENTS.map((frag, i) => (
          <div
            key={frag.id}
            ref={(el) => { cardRefs.current[i] = el }}
            style={{
              display: 'flex', flexDirection: 'column', gap: '0.85rem',
              alignItems: frag.align === 'right' ? 'flex-end' : 'flex-start',
              textAlign: frag.align,
            }}
          >
            <span className="caption" style={{ opacity: 0.6 }}>
              {frag.timestamp}
              <span style={{ margin: '0 0.5em', opacity: 0.35 }}>/</span>
              {frag.id}
            </span>
            <div className="rule-obsidian" style={{ width: '3.5rem' }} />
            <p
              ref={(el) => { textRefs.current[i] = el }}
              className="body-lg"
              style={{
                maxWidth: '36rem',
                color: 'var(--color-text)',
                minHeight: '3em',   /* prevent layout shift during typewrite */
                visibility: 'hidden',
              }}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

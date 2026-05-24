import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Scene 05 — SIGNAL
   The closing transmission. A question rises from dark.
   Behind it: a barely visible stream of archive coordinates — the machine
   still processing even as the user departs.
   Gold warmth blooms upward. Gradient title. Minimal CTA pill.              */

/* Data stream — 18 rows of archival coordinates at very low opacity */
const DATA_ROWS = Array.from({ length: 18 }, (_, i) => {
  const base = 1680000000 + i * 7193421
  return `${base.toString(16).toUpperCase()}  ·  ${(i * 3.7182818).toFixed(6)}  ·  NODE-${String(i + 1).padStart(3, '0')}`
})

export function SignalScene() {
  const sectionRef  = useRef<HTMLElement>(null)
  const glowRef     = useRef<HTMLDivElement>(null)
  const streamRef   = useRef<HTMLDivElement>(null)
  const labelRef    = useRef<HTMLParagraphElement>(null)
  const titleRef    = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const creditRef   = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const items = [labelRef, titleRef, subtitleRef, ctaRef].map(r => r.current).filter(Boolean)
      gsap.set(items, { opacity: 0, y: 36 })
      gsap.set([glowRef.current, creditRef.current, streamRef.current], { opacity: 0 })

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 70%',
        onEnter() {
          /* Data stream fades in first — sets the mood */
          gsap.to(streamRef.current, { opacity: 1, duration: 2.4, ease: 'power2.out' })
          gsap.to(glowRef.current,   { opacity: 1, duration: 3.2, ease: 'power2.out', delay: 0.2 })

          /* Content surfaces through the data */
          gsap.to(items, {
            opacity: 1, y: 0,
            duration: 1.6, stagger: 0.22, ease: 'power3.out', delay: 0.6,
          })
          gsap.to(creditRef.current, { opacity: 0.25, duration: 2, ease: 'power2.out', delay: 1.4 })
        },
      })

      /* Data stream scroll animation — rows drift upward slowly */
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 2,
        onUpdate(self) {
          if (streamRef.current) {
            gsap.set(streamRef.current, { y: -self.progress * 80 })
          }
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  function scrollToTop() {
    gsap.to(window, { scrollTo: 0, duration: 2.4, ease: 'power3.inOut' })
  }

  return (
    <section
      id="scene-signal"
      ref={sectionRef}
      style={{
        minHeight: '100dvh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 1.5rem',
        overflow: 'hidden',
      }}
    >
      {/* Data stream — very low opacity, barely visible behind content */}
      <div
        ref={streamRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '1.1rem',
          padding: '2rem 4vw',
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        {DATA_ROWS.map((row, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.62rem',
              letterSpacing: '0.12em',
              color: 'var(--color-violet-bright)',
              opacity: 0.04 + (Math.abs(i - 9) * 0.003),
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {row}
          </p>
        ))}
      </div>

      {/* Gold warmth bloom from floor */}
      <div
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 75% 55% at 50% 110%, rgba(212,175,122,0.11) 0%, transparent 60%)',
        }}
      />

      {/* Top violet vignette */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 50% -8%, rgba(124,111,255,0.06) 0%, transparent 70%)',
      }} />

      {/* Content */}
      <p ref={labelRef} className="caption" style={{ marginBottom: '2.5rem', letterSpacing: '0.2em' }}>
        Transmission End
      </p>

      <h2
        ref={titleRef}
        className="display-lg"
        style={{
          maxWidth: '80vw',
          background: 'linear-gradient(135deg, #e8e4f0 0%, #a99fff 42%, #d4af7a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Are you still{' '}
        <em
          style={{
            fontStyle: 'italic',
            fontFamily: 'var(--font-display)',
            fontWeight: 300,
            WebkitTextFillColor: 'var(--color-gold)',
          }}
        >
          here
        </em>?
      </h2>

      <p
        ref={subtitleRef}
        className="body-lg"
        style={{ marginTop: '2rem', maxWidth: '28rem' }}
      >
        The archive is patient. It has been waiting since before you arrived.
        It will continue after you leave.
      </p>

      <div ref={ctaRef} style={{ marginTop: '3.5rem' }}>
        <button
          onClick={scrollToTop}
          className="caption"
          style={{
            padding: '1rem 2.5rem',
            borderRadius: '9999px',
            border: '1px solid rgba(124,111,255,0.28)',
            background: 'rgba(124,111,255,0.06)',
            color: 'var(--color-violet-bright)',
            cursor: 'pointer',
            transition: 'border-color 0.45s, background 0.45s, transform 0.3s',
            letterSpacing: '0.14em',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'rgba(124,111,255,0.6)'
            el.style.background  = 'rgba(124,111,255,0.13)'
            el.style.transform   = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'rgba(124,111,255,0.28)'
            el.style.background  = 'rgba(124,111,255,0.06)'
            el.style.transform   = 'translateY(0)'
          }}
        >
          Return to origin
        </button>
      </div>

      <p
        ref={creditRef}
        className="caption"
        style={{
          position: 'absolute', bottom: '2rem', left: '50%',
          transform: 'translateX(-50%)', whiteSpace: 'nowrap',
        }}
      >
        OBSIDIAN · An experiment in memory and light
      </p>
    </section>
  )
}

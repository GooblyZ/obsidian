import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Scene 05 — SIGNAL
   The closing transmission. A question rises from dark.
   Enhanced with layered cinematic atmosphere: depth vignettes, breathing glow,
   void rings, and motion-layered overlays — all scoped to this section only.
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
  /* Atmospheric depth refs */
  const voidRef     = useRef<HTMLDivElement>(null)
  const rimRef      = useRef<HTMLDivElement>(null)
  const depthRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const items = [labelRef, titleRef, subtitleRef, ctaRef].map(r => r.current).filter(Boolean)
      gsap.set(items, { opacity: 0, y: 36 })
      gsap.set([glowRef.current, creditRef.current, streamRef.current], { opacity: 0 })
      gsap.set([voidRef.current, rimRef.current, depthRef.current], { opacity: 0 })

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 70%',
        onEnter() {
          /* Depth atmosphere surfaces first */
          gsap.to(depthRef.current, { opacity: 1, duration: 3.8, ease: 'power2.out' })
          gsap.to(voidRef.current,  { opacity: 1, duration: 4.2, ease: 'power2.out', delay: 0.3 })
          gsap.to(rimRef.current,   { opacity: 1, duration: 3.0, ease: 'power2.out', delay: 0.6 })

          /* Data stream and glow */
          gsap.to(streamRef.current, { opacity: 1, duration: 2.4, ease: 'power2.out', delay: 0.2 })
          gsap.to(glowRef.current,   { opacity: 1, duration: 3.2, ease: 'power2.out', delay: 0.4 })

          /* Content surfaces through */
          gsap.to(items, {
            opacity: 1, y: 0,
            duration: 1.6, stagger: 0.22, ease: 'power3.out', delay: 0.8,
          })
          gsap.to(creditRef.current, { opacity: 0.25, duration: 2, ease: 'power2.out', delay: 1.6 })
        },
      })

      /* Data stream scroll drift — rows move upward slowly */
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
      {/* ── Layer 0: deep spatial background ────────────────────────────────── */}
      {/* Far-field depth gradient — navy void at the back of the scene */}
      <div
        ref={depthRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
          background: [
            'radial-gradient(ellipse 90% 70% at 50% 50%, rgba(4,2,18,0.80) 0%, transparent 70%)',
            'radial-gradient(ellipse 60% 55% at 50% 20%, rgba(8,3,28,0.55) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      {/* ── Layer 1: void eclipse ring ───────────────────────────────────────── */}
      {/* Dark center with a violet rim — mirrors the Three.js moon orb in CSS  */}
      <div
        ref={voidRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -62%)',
          width: 'min(55vw, 420px)', height: 'min(55vw, 420px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(1,0,8,0.70) 0%, rgba(1,0,10,0.65) 45%, transparent 72%)',
          boxShadow: [
            '0 0 0 1px rgba(90,55,220,0.08)',
            '0 0 40px 0px rgba(60,25,160,0.12)',
            '0 0 120px 0px rgba(30,10,80,0.08)',
          ].join(', '),
          pointerEvents: 'none', opacity: 0,
          animation: 'signal-breathe 8s ease-in-out infinite',
        }}
      />

      {/* ── Layer 2: violet rim vignette — side curtains ─────────────────────── */}
      <div
        ref={rimRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
          background: [
            'linear-gradient(to right, rgba(6,2,22,0.55) 0%, transparent 22%, transparent 78%, rgba(6,2,22,0.55) 100%)',
            'linear-gradient(to bottom, rgba(4,1,16,0.40) 0%, transparent 18%, transparent 75%, rgba(4,1,16,0.55) 100%)',
          ].join(', '),
        }}
      />

      {/* ── Layer 3: data stream ─────────────────────────────────────────────── */}
      <div
        ref={streamRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: '1.1rem',
          padding: '2rem 4vw',
          pointerEvents: 'none', opacity: 0,
          filter: 'blur(0.3px)',
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

      {/* ── Layer 4: gold warmth bloom from floor ─────────────────────────────── */}
      <div
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: [
            'radial-gradient(ellipse 75% 55% at 50% 110%, rgba(212,175,122,0.13) 0%, transparent 60%)',
            'radial-gradient(ellipse 40% 30% at 50% 105%, rgba(180,130,80,0.08) 0%, transparent 50%)',
          ].join(', '),
          animation: 'signal-drift 12s ease-in-out infinite',
        }}
      />

      {/* ── Layer 5: top violet vignette ─────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 45% at 50% -8%, rgba(124,111,255,0.07) 0%, transparent 70%)',
        animation: 'signal-breathe 10s ease-in-out infinite',
      }} />

      {/* ── Layer 6: subtle vertical god-ray divs ─────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'linear-gradient(175deg, rgba(70,35,180,0.04) 0%, transparent 45%)',
          'linear-gradient(185deg, transparent 55%, rgba(50,20,130,0.03) 100%)',
        ].join(', '),
        animation: 'signal-ray-sway 16s ease-in-out infinite',
      }} />

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <p ref={labelRef} className="caption" style={{ marginBottom: '2.5rem', letterSpacing: '0.2em' }}>
        Transmission End
      </p>

      <h2
        ref={titleRef}
        className="display-lg"
        style={{ maxWidth: '80vw', color: 'var(--color-text)' }}
      >
        Are you still{' '}
        <em className="em">here</em>?
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

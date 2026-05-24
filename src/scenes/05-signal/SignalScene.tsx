import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

/* Scene 05 — SIGNAL / STILLNESS
   The section is intentionally near-empty — it exists as atmospheric space
   for the bat to inhabit. The Three.js canvas (BatFlyer) is the primary
   visual: eclipse orb, depth particles, wing trail.

   This component provides only a dark vessel with:
   · faint archival data stream (almost invisible texture)
   · barely-there gold warmth rising from below
   · a quiet question, small as a whisper
   · nothing else — no borders, no CTAs, no layered UI               */

const DATA_ROWS = Array.from({ length: 18 }, (_, i) => {
  const base = 1680000000 + i * 7193421
  return `${base.toString(16).toUpperCase()}  ·  ${(i * 3.7182818).toFixed(6)}  ·  NODE-${String(i + 1).padStart(3, '0')}`
})

export function SignalScene() {
  const sectionRef = useRef<HTMLElement>(null)
  const streamRef  = useRef<HTMLDivElement>(null)
  const glowRef    = useRef<HTMLDivElement>(null)
  const labelRef   = useRef<HTMLParagraphElement>(null)
  const titleRef   = useRef<HTMLHeadingElement>(null)
  const creditRef  = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set([labelRef.current, titleRef.current], { opacity: 0, y: 18 })
      gsap.set([streamRef.current, glowRef.current, creditRef.current], { opacity: 0 })

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 68%',
        onEnter() {
          /* Atmosphere surfaces first — very slow, no rush */
          gsap.to(streamRef.current, { opacity: 1, duration: 4.0, ease: 'power1.out' })
          gsap.to(glowRef.current,   { opacity: 1, duration: 5.0, ease: 'power1.out', delay: 0.4 })

          /* Text arrives late, as if an afterthought */
          gsap.to(labelRef.current, {
            opacity: 0.40, y: 0, duration: 2.4, ease: 'power2.out', delay: 1.2,
          })
          gsap.to(titleRef.current, {
            opacity: 0.52, y: 0, duration: 2.8, ease: 'power2.out', delay: 1.8,
          })
          gsap.to(creditRef.current, {
            opacity: 0.16, duration: 3.0, ease: 'power1.out', delay: 2.6,
          })
        },
      })

      /* Data stream drifts upward as you read */
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 2.5,
        onUpdate(self) {
          if (streamRef.current) gsap.set(streamRef.current, { y: -self.progress * 70 })
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="scene-signal"
      ref={sectionRef}
      style={{
        minHeight:      '100dvh',
        position:       'relative',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'flex-end',   /* text drifts to lower third */
        textAlign:      'center',
        padding:        '0 1.5rem 18dvh',
        overflow:       'hidden',
      }}
    >
      {/* ── Archival data stream — near-invisible background texture ── */}
      <div
        ref={streamRef}
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          display:       'flex',
          flexDirection: 'column',
          justifyContent:'center',
          gap:           '1.1rem',
          padding:       '2rem 4vw',
          pointerEvents: 'none',
          opacity:       0,
        }}
      >
        {DATA_ROWS.map((row, i) => (
          <p
            key={i}
            style={{
              fontFamily:  'var(--font-body)',
              fontSize:    '0.60rem',
              letterSpacing:'0.12em',
              color:       'var(--color-violet-bright)',
              opacity:     0.025 + Math.abs(i - 9) * 0.002,
              textAlign:   'left',
              whiteSpace:  'nowrap',
              overflow:    'hidden',
            }}
          >{row}</p>
        ))}
      </div>

      {/* ── Gold warmth — barely there, rises from below ── */}
      <div
        ref={glowRef}
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          pointerEvents: 'none',
          background:    'radial-gradient(ellipse 65% 40% at 50% 118%, rgba(212,175,122,0.08) 0%, transparent 52%)',
          animation:     'signal-drift 16s ease-in-out infinite',
        }}
      />

      {/* ── Text — whisper-level, not a headline ── */}
      <p
        ref={labelRef}
        className="caption"
        style={{
          marginBottom:  '1.4rem',
          letterSpacing: '0.20em',
          opacity:       0,
        }}
      >
        Transmission End
      </p>

      <h2
        ref={titleRef}
        style={{
          fontFamily:    'var(--font-display)',
          fontSize:      'clamp(1.1rem, 2.6vw, 1.8rem)',
          fontWeight:    200,
          letterSpacing: '0.07em',
          lineHeight:    1.5,
          color:         'rgba(220,214,255,1)',  /* full color, opacity set by GSAP */
          opacity:       0,
          margin:        0,
        }}
      >
        Are you still{' '}
        <em style={{ fontStyle: 'italic', color: 'rgba(180,160,255,1)' }}>here</em>?
      </h2>

      {/* ── Credit ── */}
      <p
        ref={creditRef}
        className="caption"
        style={{
          position:  'absolute',
          bottom:    '2.2rem',
          left:      '50%',
          transform: 'translateX(-50%)',
          whiteSpace:'nowrap',
          opacity:   0,
        }}
      >
        OBSIDIAN · An experiment in memory and light
      </p>
    </section>
  )
}

import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'
import { splitChars } from '../../lib/splitText'

/* Scene 01 — HERO
   Sticky content anchors to the top of the viewport while the 220dvh section
   scrolls past. Title characters rise one-by-one on entrance; on scroll the
   whole title scales and fades — the reader is pulled into the archive. */
export function HeroScene() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef   = useRef<HTMLHeadingElement>(null)
  const tagRef     = useRef<HTMLParagraphElement>(null)
  const captionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const title   = titleRef.current
    const tag     = tagRef.current
    const caption = captionRef.current
    if (!title || !tag || !caption) return

    const cleanup = splitChars(title)
    const chars = Array.from(title.querySelectorAll<HTMLSpanElement>('[data-reveal="char"]'))

    /* Use GSAP context so revert() cleans up only this scene's animations */
    const ctx = gsap.context(() => {
      /* Entrance */
      const tl = gsap.timeline({ delay: 1.6 })  /* wait for preloader to clear */
      tl.to(caption, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' })
        .to(chars, {
          opacity: 1, y: 0, rotateX: 0,
          duration: 1.4, stagger: 0.055, ease: 'power3.out',
        }, '-=0.45')
        /* Letter-spacing compresses on entrance — letters breathe in */
        .to(title, { letterSpacing: '-0.025em', duration: 1.2, ease: 'power2.out' }, '-=0.8')
        .to(tag, { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out' }, '-=0.7')

      /* Scroll exit — title swells and dissolves */
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.8,
        onUpdate(self) {
          const p = self.progress
          gsap.set(title,   { scale: 1 + p * 0.13, opacity: Math.max(0, 1 - p * 1.7), y: -p * 45 })
          gsap.set(tag,     { opacity: Math.max(0, 1 - p * 2.6), y: -p * 25 })
          gsap.set(caption, { opacity: Math.max(0, 1 - p * 3.2) })
        },
      })
    }, sectionRef)

    return () => {
      ctx.revert()
      cleanup()
    }
  }, [])

  return (
    <section
      id="scene-hero"
      ref={sectionRef}
      style={{ minHeight: '220dvh', position: 'relative' }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1.5rem',
          overflow: 'hidden',
        }}
      >
        {/* Ambient violet glow behind title */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 45% at 50% 50%, rgba(124,111,255,0.08) 0%, transparent 70%)',
        }} />

        <p ref={captionRef} className="caption"
           style={{ marginBottom: '2rem', letterSpacing: '0.22em', opacity: 0, transform: 'translateY(14px)' }}>
          Digital Consciousness Archive
        </p>

        <h1
          ref={titleRef}
          className="display-xl word-glow"
          style={{
            userSelect: 'none',
            perspective: '900px',
            perspectiveOrigin: '50% 50%',
            letterSpacing: '0.35em',   /* starts wide, compresses to -0.025em */
          }}
        >
          OBSIDIAN
        </h1>

        <p ref={tagRef} className="body-lg"
           style={{ marginTop: '2.5rem', maxWidth: '28rem', opacity: 0, transform: 'translateY(28px)' }}>
          Every memory is a fragment of{' '}
          <span className="em">light</span>
          {' '}held inside stone.
        </p>

        {/* Scroll pulse */}
        <div style={{
          position: 'absolute', bottom: '3rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
        }}>
          <span className="caption">scroll</span>
          <div style={{
            width: '1px', height: '3rem', transformOrigin: 'top',
            background: 'linear-gradient(to bottom, rgba(124,111,255,0.7), transparent)',
            animation: 'scrollPulse 2.4s ease-in-out infinite',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes scrollPulse {
          0%   { transform: scaleY(0); opacity: 0; }
          35%  { opacity: 1; }
          100% { transform: scaleY(1); opacity: 0; }
        }
      `}</style>
    </section>
  )
}

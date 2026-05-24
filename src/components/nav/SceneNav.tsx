import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

const SCENES = [
  { id: 'scene-hero',     label: 'Entry'   },
  { id: 'scene-fragment', label: 'Fragment'},
  { id: 'scene-breath',   label: ''        }, /* silence — no dot */
  { id: 'scene-archive',  label: 'Archive' },
  { id: 'scene-signal',   label: 'Signal'  },
]

const NAV_SCENES = SCENES.filter((s) => s.label)

export function SceneNav() {
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const triggers = NAV_SCENES.map((scene, i) => {
      const el = document.getElementById(scene.id)
      if (!el) return null

      return ScrollTrigger.create({
        trigger: el,
        start: 'top center',
        end: 'bottom center',
        onEnter:      () => setActive(i),
        onEnterBack:  () => setActive(i),
      })
    })

    function setActive(activeIndex: number) {
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return
        dot.classList.toggle('active', i === activeIndex)
      })
    }

    return () => triggers.forEach((t) => t?.kill())
  }, [])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    gsap.to(window, { scrollTo: el, duration: 1.6, ease: 'power3.inOut' })
  }

  return (
    <nav
      aria-label="Scene navigation"
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3"
    >
      {NAV_SCENES.map((scene, i) => (
        <button
          key={scene.id}
          ref={(el) => { dotRefs.current[i] = el }}
          onClick={() => scrollTo(scene.id)}
          title={scene.label}
          aria-label={`Navigate to ${scene.label}`}
          className="nav-dot focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-violet)]"
        />
      ))}
    </nav>
  )
}

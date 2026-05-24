import { useEffect, useRef } from 'react'
import { ScrollTrigger } from '../lib/gsap'

/**
 * Returns a ref to a mutable scroll progress value (0–1).
 * Updates on every scroll frame without triggering React re-renders.
 */
export function useScrollProgress() {
  const progress = useRef(0)

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        progress.current = self.progress
      },
    })
    return () => trigger.kill()
  }, [])

  return progress
}

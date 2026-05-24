import { useEffect, useRef } from 'react'

/* Custom cursor — a minimal ring that follows the mouse with soft lag.
   Grows slightly over headings and clickable elements.
   Hidden on touch/mobile devices (hover: none).                             */
export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ring = ringRef.current!
    const dot  = dotRef.current!
    if (!ring || !dot) return

    let mx = -100, my = -100   /* start off-screen */
    let cx = -100, cy = -100   /* current (lagged) position */
    let raf: number
    let isHovering = false

    function onMove(e: MouseEvent) {
      mx = e.clientX
      my = e.clientY
      /* Dot snaps immediately */
      dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`
    }

    function onEnter(e: MouseEvent) {
      const t = e.target as HTMLElement
      const isInteractive = t.matches('h1, h2, h3, button, a, [data-hover]')
      if (isInteractive !== isHovering) {
        isHovering = isInteractive
        ring.style.width  = isHovering ? '40px' : '22px'
        ring.style.height = isHovering ? '40px' : '22px'
        ring.style.opacity = isHovering ? '0.5' : '0.35'
      }
    }

    function animate() {
      raf = requestAnimationFrame(animate)
      /* Lag: ring chases mouse at 12% per frame */
      cx += (mx - cx) * 0.12
      cy += (my - cy) * 0.12
      ring.style.transform = `translate(${cx - 11}px, ${cy - 11}px)`
    }

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onEnter)
    raf = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onEnter)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Lagging outer ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '22px', height: '22px',
          borderRadius: '50%',
          border: '1px solid rgba(169,159,255,0.5)',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.35,
          transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1), height 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.25s',
          mixBlendMode: 'screen',
        }}
      />
      {/* Snap dot */}
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '6px', height: '6px',
          borderRadius: '50%',
          background: 'rgba(169,159,255,0.7)',
          pointerEvents: 'none',
          zIndex: 9999,
          mixBlendMode: 'screen',
        }}
      />
    </>
  )
}

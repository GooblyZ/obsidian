/* Shared mutable mouse position — updated by a single global listener.
   Components read this inside animation loops; it never triggers re-renders.
   Import and read mousePos.x / mousePos.y anywhere.                          */
export const mousePos = {
  x:      -9999,
  y:      -9999,
  active: false,   /* false until first move — prevents false interactions */
}

if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    mousePos.x      = e.clientX
    mousePos.y      = e.clientY
    mousePos.active = true
  }, { passive: true })
}

/* Typewriter utility — reveals text character by character via a cursor.
   Returns a cleanup function that resets the element.
   duration: total milliseconds for the full string.                       */
export function typewrite(
  el: HTMLElement,
  text: string,
  duration: number,
  onComplete?: () => void
): () => void {
  el.textContent = ''
  el.style.visibility = 'visible'

  const perChar = duration / text.length
  let i = 0
  let timer: ReturnType<typeof setTimeout>

  function tick() {
    if (i >= text.length) {
      onComplete?.()
      return
    }
    el.textContent = text.slice(0, ++i)
    timer = setTimeout(tick, perChar)
  }

  tick()

  return () => {
    clearTimeout(timer)
    el.textContent = text  /* restore full text on cleanup */
  }
}

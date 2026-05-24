/**
 * Split an element's text into individual character spans.
 * Each span gets data-reveal="char" so GSAP can stagger them.
 * Returns a cleanup function that restores original content.
 */
export function splitChars(el: HTMLElement): () => void {
  const original = el.innerHTML
  const text = el.textContent ?? ''

  const html = text
    .split('')
    .map((ch) =>
      ch === ' '
        ? '<span style="display:inline-block;width:0.28em"></span>'
        : `<span data-reveal="char" style="display:inline-block">${ch}</span>`
    )
    .join('')

  el.innerHTML = html

  return () => {
    el.innerHTML = original
  }
}

/**
 * Split element text into word spans.
 */
export function splitWords(el: HTMLElement): () => void {
  const original = el.innerHTML
  const words = (el.textContent ?? '').split(' ')

  el.innerHTML = words
    .map((w) => `<span data-reveal style="display:inline-block;margin-right:0.25em">${w}</span>`)
    .join('')

  return () => {
    el.innerHTML = original
  }
}

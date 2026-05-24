import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

/* Global GSAP defaults — all animations inherit these unless overridden */
gsap.defaults({
  ease: 'power3.out',
  duration: 1.2,
})

ScrollTrigger.defaults({
  toggleActions: 'play none none reverse',
})

export { gsap, ScrollTrigger }

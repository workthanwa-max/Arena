import gsap from 'gsap'

/**
 * Unified GSAP Motion Tokens (synchronized with Phaser Tweens & frontend-design skill)
 */
export const MOTION = {
  durationFast: 0.2,
  durationNormal: 0.35,
  durationDeliberate: 0.5,
  easeSpring: 'back.out(1.4)',
  easeSmooth: 'power3.out',
} as const

export function animateCardEnter(target: HTMLElement | null): void {
  if (!target) return
  gsap.fromTo(
    target,
    { opacity: 0.9, y: 10, scale: 0.99 },
    { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: MOTION.easeSmooth, clearProps: 'transform' },
  )
}

export function animateSpringPop(target: HTMLElement | null): void {
  if (!target) return
  gsap.fromTo(
    target,
    { opacity: 0, scale: 0.88 },
    { opacity: 1, scale: 1, duration: MOTION.durationNormal, ease: MOTION.easeSpring, clearProps: 'transform' },
  )
}

export function animateShowroomSwap(target: HTMLElement | null, direction: number): void {
  if (!target) return
  gsap.fromTo(
    target,
    { opacity: 0, x: direction >= 0 ? 36 : -36, scale: 0.96 },
    { opacity: 1, x: 0, scale: 1, duration: 0.34, ease: MOTION.easeSmooth, clearProps: 'transform' },
  )
}

export function animateStaggerItems(targets: Element[] | NodeListOf<Element>): void {
  if (!targets || targets.length === 0) return
  gsap.fromTo(
    targets,
    { opacity: 0, y: 10 },
    {
      opacity: 1,
      y: 0,
      duration: MOTION.durationFast,
      stagger: 0.035,
      ease: MOTION.easeSmooth,
      clearProps: 'transform',
    },
  )
}

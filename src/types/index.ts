export type RevealVariant = 'default' | 'char' | 'fade' | 'left'

export interface SceneConfig {
  id: string
  label: string       /* nav dot tooltip */
  scrollStart: number /* 0–1, fraction of total page height */
}

export interface ParticleConfig {
  count: number
  spread: number
  speed: number
  color: string
}

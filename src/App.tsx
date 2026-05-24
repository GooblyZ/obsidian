import './App.css'
import { Suspense, lazy } from 'react'
import { AmbientGradient }  from './components/canvas/AmbientGradient'
import { SceneNav }         from './components/nav/SceneNav'
import { PersistentCTA }    from './components/nav/PersistentCTA'
import { SweepLine }        from './components/ui/SweepLine'
import { CustomCursor }     from './components/ui/CustomCursor'
import { Preloader }        from './components/ui/Preloader'
import { HeroScene }        from './scenes/01-hero/HeroScene'
import { FragmentScene }    from './scenes/02-fragment/FragmentScene'
import { RunnerScene }      from './scenes/02b-runner/RunnerScene'
import { BreathScene }      from './scenes/03-breath/BreathScene'
import { ArchiveScene }     from './scenes/04-archive/ArchiveScene'
import { SignalScene }      from './scenes/05-signal/SignalScene'

/* Three.js canvas — lazy loaded so text narrative renders immediately.
   The WebGL layer is a visual enhancement, not a requirement.             */
const ObsidianCanvas = lazy(() =>
  import('./components/canvas/ObsidianCanvas').then(m => ({ default: m.ObsidianCanvas }))
)

export default function App() {
  return (
    <>
      <Preloader />
      <CustomCursor />

      {/* Three.js loads async — canvas appears when ready */}
      <Suspense fallback={null}>
        <ObsidianCanvas />
      </Suspense>

      <AmbientGradient />
      <SceneNav />
      <PersistentCTA />

      <main id="scroll-content">

        <HeroScene />
        <div style={{ padding: '0 6vw' }}><SweepLine color="violet" /></div>

        <FragmentScene />

        <RunnerScene />
        <div style={{ padding: '0 6vw' }}><SweepLine color="teal" delay={0.1} /></div>

        <BreathScene />
        <div style={{ padding: '0 6vw' }}><SweepLine color="teal" delay={0.2} /></div>

        <ArchiveScene />
        <div style={{ padding: '0 6vw' }}><SweepLine color="gold" delay={0.1} /></div>

        <SignalScene />

      </main>
    </>
  )
}

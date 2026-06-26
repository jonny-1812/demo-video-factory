import React from 'react'
import { AbsoluteFill } from 'remotion'
import { TransitionSeries, springTiming } from '@remotion/transitions'
import { wipe } from '@remotion/transitions/wipe'
import { Pain, Reveal, Wow, Outcome } from '../templates/scenes'
import { brief } from './brief'

export const DemoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d12' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <Pain brief={brief} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: 14 })} presentation={wipe({ direction: 'from-right' })} />
        <TransitionSeries.Sequence durationInFrames={234}>
          <Reveal brief={brief} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: 14 })} presentation={wipe({ direction: 'from-right' })} />
        <TransitionSeries.Sequence durationInFrames={300}>
          <Wow brief={brief} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: 14 })} presentation={wipe({ direction: 'from-right' })} />
        <TransitionSeries.Sequence durationInFrames={168}>
          <Outcome brief={brief} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  )
}

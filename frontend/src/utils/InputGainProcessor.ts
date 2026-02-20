import type { AudioProcessorOptions, TrackProcessor } from 'livekit-client';
import { Track } from 'livekit-client';

export interface InputGainProcessorRef {
  gain: number;
  gainNode: GainNode | null;
}

/**
 * Creates a TrackProcessor that applies gain to the microphone input.
 * Store the returned ref and update ref.gainNode.gain.value when gain changes.
 * ref.gainNode is set in init, so check it after the track is created.
 */
export function createInputGainProcessor(ref: InputGainProcessorRef): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  let destNode: MediaStreamAudioDestinationNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;

  const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: 'input-gain',
    processedTrack: undefined,

    async init(opts: AudioProcessorOptions) {
      const ctx = opts.audioContext;
      const stream = new MediaStream([opts.track]);
      sourceNode = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0.5, Math.min(2, ref.gain));
      ref.gainNode = gainNode;
      destNode = ctx.createMediaStreamDestination();
      sourceNode.connect(gainNode);
      gainNode.connect(destNode);
      processor.processedTrack = destNode.stream.getAudioTracks()[0];
    },

    async restart() {
      if (ref.gainNode) {
        ref.gainNode.gain.value = Math.max(0.5, Math.min(2, ref.gain));
      }
    },

    async destroy() {
      ref.gainNode?.disconnect();
      ref.gainNode = null;
      sourceNode?.disconnect();
      destNode?.stream.getTracks().forEach((t) => t.stop());
      processor.processedTrack = undefined;
      destNode = null;
      sourceNode = null;
    },
  };

  return processor;
}

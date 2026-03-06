import type { AudioProcessorOptions, TrackProcessor } from 'livekit-client';
import { Track } from 'livekit-client';

export interface NoiseGateOptions {
  threshold: number; // dB, -60 to 0
  attack: number;    // ms, 1-100
  release: number;   // ms, 20-500
}

/** Ref that lets us update worklet params without recreating the processor. */
export interface NoiseGateProcessorRef {
  node: AudioWorkletNode | null;
  options: NoiseGateOptions;
}

/** Convert dB to linear amplitude (0 dB = 1.0). */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Key stored on AudioContext to prevent loading the worklet module twice
 * on the same context (addModule throws if called again with the same name).
 */
const WORKLET_LOADED_KEY = '__noiseGateWorkletLoaded';

export function createNoiseGateProcessor(
  ref: NoiseGateProcessorRef,
): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  // Saved during init() — LiveKit does NOT pass audioContext in restart() opts
  let savedCtx: AudioContext | null = null;

  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let destNode: MediaStreamAudioDestinationNode | null = null;

  function sendParams() {
    if (!ref.node) return;
    ref.node.port.postMessage({
      threshold: dbToLinear(ref.options.threshold),
      attackMs: ref.options.attack,
      releaseMs: ref.options.release,
    });
  }

  async function buildGraph(ctx: AudioContext, track: MediaStreamTrack) {
    // Load worklet module once per AudioContext instance
    const ctxExt = ctx as unknown as Record<string, unknown>;
    if (!ctxExt[WORKLET_LOADED_KEY]) {
      await ctx.audioWorklet.addModule('/noise-gate-worklet.js');
      ctxExt[WORKLET_LOADED_KEY] = true;
    }

    const stream = new MediaStream([track]);
    sourceNode = ctx.createMediaStreamSource(stream);
    destNode = ctx.createMediaStreamDestination();
    workletNode = new AudioWorkletNode(ctx, 'noise-gate-processor');

    sourceNode.connect(workletNode);
    workletNode.connect(destNode);

    ref.node = workletNode;
    sendParams();

    processor.processedTrack = destNode.stream.getAudioTracks()[0];
  }

  /** Disconnect nodes without stopping the destination tracks (used during restart). */
  function disconnectGraph() {
    sourceNode?.disconnect();
    workletNode?.disconnect();
    ref.node = null;
    workletNode = null;
    sourceNode = null;
    destNode = null;
  }

  /** Full cleanup including stopping destination tracks (used during destroy). */
  function destroyGraph() {
    sourceNode?.disconnect();
    workletNode?.disconnect();
    ref.node = null;
    workletNode = null;
    sourceNode = null;
    destNode?.stream?.getTracks()?.forEach((t) => t.stop());
    destNode = null;
    processor.processedTrack = undefined;
  }

  const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: 'noise-gate',
    processedTrack: undefined,

    async init(opts: AudioProcessorOptions) {
      savedCtx = opts.audioContext;
      await buildGraph(opts.audioContext, opts.track);
    },

    async restart(opts: AudioProcessorOptions) {
      // LiveKit calls this after restartTrack() with the new underlying MediaStreamTrack.
      // IMPORTANT: opts.audioContext is NOT set by LiveKit in restart — use savedCtx.
      const ctx = opts.audioContext ?? savedCtx;
      if (!ctx) {
        console.error('[NoiseGate] restart: no AudioContext available, skipping graph rebuild');
        return;
      }

      disconnectGraph();

      try {
        await buildGraph(ctx, opts.track);
      } catch (e) {
        console.error('[NoiseGate] restart: failed to rebuild graph:', e);
        // Do not rethrow — let LiveKit continue with the raw track
      }
    },

    async destroy() {
      destroyGraph();
      savedCtx = null;
    },
  };

  return processor;
}

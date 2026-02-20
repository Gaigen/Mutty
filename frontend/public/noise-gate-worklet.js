/**
 * AudioWorklet processor for Noise Gate.
 * Runs in a dedicated audio thread — no main thread blocking.
 *
 * Algorithm:
 *  1. Peak envelope follower with separate attack/release coefficients.
 *  2. Gate target: 1 when envelope > threshold, 0 otherwise.
 *  3. Gate gain smoothed with the same attack/release to avoid clicks.
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Defaults — overridden immediately via postMessage from init()
    this._threshold = 0.01; // linear (~-40 dB)
    this._attackCoeff = 0.0;
    this._releaseCoeff = 0.0;
    this._attackMs = 10;
    this._releaseMs = 100;

    this._envLevel = 0;
    this._gateGain = 0;

    this._updateCoeffs(this._attackMs, this._releaseMs);

    this.port.onmessage = (e) => {
      const { threshold, attackMs, releaseMs } = e.data;
      if (threshold !== undefined) {
        this._threshold = Math.max(0, threshold);
      }
      if (attackMs !== undefined || releaseMs !== undefined) {
        this._updateCoeffs(
          attackMs !== undefined ? attackMs : this._attackMs,
          releaseMs !== undefined ? releaseMs : this._releaseMs,
        );
      }
    };
  }

  /** Precompute one-pole IIR coefficients from time constants. */
  _updateCoeffs(attackMs, releaseMs) {
    this._attackMs = Math.max(0.1, attackMs);
    this._releaseMs = Math.max(0.1, releaseMs);
    // sampleRate is a global in AudioWorkletGlobalScope
    this._attackCoeff = Math.exp(-1000 / (this._attackMs * sampleRate));
    this._releaseCoeff = Math.exp(-1000 / (this._releaseMs * sampleRate));
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || !output || !output.length) return true;

    const numChannels = Math.min(input.length, output.length);
    const blockSize = input[0].length;

    for (let i = 0; i < blockSize; i++) {
      // Peak detection across all channels
      let peak = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        const abs = Math.abs(input[ch][i]);
        if (abs > peak) peak = abs;
      }

      // Envelope follower: fast attack, slow release
      if (peak > this._envLevel) {
        this._envLevel = peak + (this._envLevel - peak) * this._attackCoeff;
      } else {
        this._envLevel = peak + (this._envLevel - peak) * this._releaseCoeff;
      }

      // Target gate state
      const gateTarget = this._envLevel > this._threshold ? 1.0 : 0.0;

      // Smooth the gate gain to avoid hard clicks
      if (gateTarget > this._gateGain) {
        this._gateGain += (gateTarget - this._gateGain) * (1 - this._attackCoeff);
      } else {
        this._gateGain += (gateTarget - this._gateGain) * (1 - this._releaseCoeff);
      }

      // Write to all output channels
      for (let ch = 0; ch < numChannels; ch++) {
        output[ch][i] = input[ch][i] * this._gateGain;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);

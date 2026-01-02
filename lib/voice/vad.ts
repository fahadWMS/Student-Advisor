/**
 * Voice Activity Detection (VAD) using Web Audio API
 * Detects when user stops speaking based on audio volume levels
 */

export interface VADConfig {
  /** Minimum silence duration (ms) before triggering stop */
  silenceThreshold: number;
  /** Volume threshold (0-255) below which is considered silence */
  volumeThreshold: number;
  /** How often to check audio levels (ms) */
  checkInterval: number;
  /** Minimum speech duration (ms) before considering it real speech */
  minSpeechDuration: number;
  /** Delay (ms) after start before VAD becomes active */
  activationDelay: number;
}

const DEFAULT_CONFIG: VADConfig = {
  silenceThreshold: 2000, // 2 seconds of silence
  volumeThreshold: 40, // Adjust based on mic sensitivity
  checkInterval: 100, // Check every 100ms
  minSpeechDuration: 500, // Must speak for 500ms to be considered speech
  activationDelay: 2000, // Wait 2s after start before VAD activates
};

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private silenceStart: number | null = null;
  private speechStart: number | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private onSilenceCallback: (() => void) | null = null;
  private onSpeakingCallback: (() => void) | null = null;
  private config: VADConfig;
  private isActive = false;
  private vadActivationTime: number | null = null;
  private hasSpeechStarted = false;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(
    stream: MediaStream,
    onSilence: () => void,
    onSpeaking?: () => void
  ): Promise<void> {
    this.stream = stream;
    this.onSilenceCallback = onSilence;
    this.onSpeakingCallback = onSpeaking || null;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.isActive = true;
    this.silenceStart = null;
    this.speechStart = null;
    this.vadActivationTime = Date.now() + this.config.activationDelay;
    this.hasSpeechStarted = false;
    this.checkIntervalId = setInterval(() => this.checkVolume(), this.config.checkInterval);
  }

  private checkVolume(): void {
    if (!this.analyser || !this.isActive) return;

    const now = Date.now();
    
    // Don't activate VAD until after activation delay
    if (this.vadActivationTime && now < this.vadActivationTime) {
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    const isSilent = average < this.config.volumeThreshold;

    if (!isSilent) {
      // User is speaking
      if (this.speechStart === null) {
        this.speechStart = now;
      } else {
        const speechDuration = now - this.speechStart;
        if (!this.hasSpeechStarted && speechDuration >= this.config.minSpeechDuration) {
          // Confirmed speech detected
          this.hasSpeechStarted = true;
          this.onSpeakingCallback?.();
        }
      }
      // Reset silence timer when speaking
      this.silenceStart = null;
    } else {
      // Silent
      this.speechStart = null;
      
      // Only track silence if speech has started
      if (this.hasSpeechStarted) {
        if (this.silenceStart === null) {
          this.silenceStart = now;
        } else {
          const silenceDuration = now - this.silenceStart;
          if (silenceDuration >= this.config.silenceThreshold) {
            this.onSilenceCallback?.();
            this.silenceStart = null;
          }
        }
      }
    }
  }

  stop(): void {
    this.isActive = false;
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.silenceStart = null;
    this.speechStart = null;
    this.vadActivationTime = null;
    this.hasSpeechStarted = false;
  }

  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

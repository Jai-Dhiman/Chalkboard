type AudioLevelCallback = (level: number) => void;
type AudioChunkCallback = (chunk: string) => void;

// Grok uses 24kHz PCM16
const TARGET_SAMPLE_RATE = 24000;

class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private audioChunkCallback: AudioChunkCallback | null = null;
  private animationFrameId: number | null = null;
  private isCapturing = false;
  private inputSampleRate = 48000; // Will be set on capture

  // Playback
  private playbackContext: AudioContext | null = null;
  private nextPlayTime = 0;

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('[AudioService] Microphone permission denied:', error);
      throw new Error('Microphone permission denied');
    }
  }

  async startCapture(
    onAudioLevel: AudioLevelCallback,
    onAudioChunk: AudioChunkCallback
  ): Promise<void> {
    if (this.isCapturing) {
      console.log('[AudioService] Already capturing');
      return;
    }

    console.log('[AudioService] Starting capture...');

    this.audioLevelCallback = onAudioLevel;
    this.audioChunkCallback = onAudioChunk;

    // Get microphone stream first (let browser choose sample rate)
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    console.log('[AudioService] Got media stream');

    // Create audio context - let browser use its default sample rate
    // We'll resample to 24kHz before sending
    this.audioContext = new AudioContext();
    this.inputSampleRate = this.audioContext.sampleRate;

    console.log(`[AudioService] Audio context sample rate: ${this.inputSampleRate}Hz, target: ${TARGET_SAMPLE_RATE}Hz`);

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Analyser for audio level visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    // Use ScriptProcessor for audio chunks
    // Use larger buffer for lower sample rates
    const bufferSize = 4096;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Resample to target rate if needed
      let processedData: Float32Array;
      if (this.inputSampleRate !== TARGET_SAMPLE_RATE) {
        processedData = this.resample(inputData, this.inputSampleRate, TARGET_SAMPLE_RATE);
      } else {
        processedData = inputData;
      }

      const base64Chunk = this.floatArrayToBase64PCM16(processedData);
      this.audioChunkCallback?.(base64Chunk);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.isCapturing = true;
    this.updateAudioLevel();

    console.log('[AudioService] Capture started');
  }

  stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    console.log('[AudioService] Stopping capture...');

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.isCapturing = false;
    this.audioLevelCallback?.(0);

    console.log('[AudioService] Capture stopped');
  }

  async playAudio(base64Audio: string): Promise<void> {
    // Create playback context if needed
    if (!this.playbackContext || this.playbackContext.state === 'closed') {
      this.playbackContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      this.nextPlayTime = this.playbackContext.currentTime;
    }

    // Resume if suspended (browser autoplay policy)
    if (this.playbackContext.state === 'suspended') {
      await this.playbackContext.resume();
    }

    // Decode base64 PCM16 to Float32
    const pcm16 = this.base64ToPCM16(base64Audio);
    const float32 = this.pcm16ToFloat32(pcm16);

    // Create audio buffer
    const audioBuffer = this.playbackContext.createBuffer(1, float32.length, TARGET_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    // Create and schedule source
    const source = this.playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackContext.destination);

    // Schedule playback
    const startTime = Math.max(this.nextPlayTime, this.playbackContext.currentTime);
    source.start(startTime);

    // Update next play time for seamless playback
    this.nextPlayTime = startTime + audioBuffer.duration;
  }

  stopPlayback(): void {
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
      this.nextPlayTime = 0;
    }
  }

  private updateAudioLevel(): void {
    if (!this.analyser || !this.isCapturing) {
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const level = Math.min(1, rms / 128);

    this.audioLevelCallback?.(level);

    this.animationFrameId = requestAnimationFrame(() => this.updateAudioLevel());
  }

  // Simple linear interpolation resampling
  private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) {
      return input;
    }

    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;

      // Linear interpolation
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }

    return output;
  }

  // Convert Float32Array to base64-encoded PCM16
  private floatArrayToBase64PCM16(floatArray: Float32Array): string {
    const int16Array = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArray[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert base64 to Int16Array (PCM16)
  private base64ToPCM16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  // Convert PCM16 to Float32Array
  private pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }
    return float32;
  }

  getIsCapturing(): boolean {
    return this.isCapturing;
  }
}

export const audioService = new AudioService();

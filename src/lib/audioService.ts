type AudioLevelCallback = (level: number) => void;
type AudioChunkCallback = (chunk: string) => void;

// Chunk duration in milliseconds (matches working xai-voice-examples)
const CHUNK_DURATION_MS = 100;

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

  // Audio buffer for chunking (like working example)
  private audioBuffer: Float32Array[] = [];
  private totalSamples = 0;

  // Playback
  private playbackContext: AudioContext | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlaying = false;
  private currentPlaybackSource: AudioBufferSourceNode | null = null;

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
  ): Promise<number> {
    if (this.isCapturing) {
      console.log('[AudioService] Already capturing');
      return this.inputSampleRate;
    }

    console.log('[AudioService] Starting capture...');

    this.audioLevelCallback = onAudioLevel;
    this.audioChunkCallback = onAudioChunk;

    // Reset audio buffer
    this.audioBuffer = [];
    this.totalSamples = 0;

    // Create audio context first to get native sample rate (like working example)
    this.audioContext = new AudioContext();
    this.inputSampleRate = this.audioContext.sampleRate;

    console.log(`[AudioService] Audio context sample rate: ${this.inputSampleRate}Hz (native)`);

    // Get microphone stream with native sample rate
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.inputSampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    console.log('[AudioService] Got media stream');

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Analyser for audio level visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    // Use ScriptProcessor for audio chunks (like working example)
    const bufferSize = 4096;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    // Calculate chunk size in samples for ~100ms chunks
    const chunkSizeSamples = Math.floor((this.inputSampleRate * CHUNK_DURATION_MS) / 1000);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Calculate audio level for visualization
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.audioLevelCallback?.(rms);

      // Buffer audio data (like working example)
      this.audioBuffer.push(new Float32Array(inputData));
      this.totalSamples += inputData.length;

      // Send chunks of ~100ms (like working example)
      while (this.totalSamples >= chunkSizeSamples) {
        const chunk = new Float32Array(chunkSizeSamples);
        let offset = 0;

        while (offset < chunkSizeSamples && this.audioBuffer.length > 0) {
          const buffer = this.audioBuffer[0];
          const needed = chunkSizeSamples - offset;
          const available = buffer.length;

          if (available <= needed) {
            // Use entire buffer
            chunk.set(buffer, offset);
            offset += available;
            this.totalSamples -= available;
            this.audioBuffer.shift();
          } else {
            // Use part of buffer
            chunk.set(buffer.subarray(0, needed), offset);
            this.audioBuffer[0] = buffer.subarray(needed);
            offset += needed;
            this.totalSamples -= needed;
          }
        }

        // Convert to PCM16 and send (no resampling - send at native rate)
        const base64Chunk = this.floatArrayToBase64PCM16(chunk);
        this.audioChunkCallback?.(base64Chunk);
      }
    };

    source.connect(this.processor);
    // Note: ScriptProcessorNode requires connection to destination to work
    this.processor.connect(this.audioContext.destination);

    this.isCapturing = true;
    this.updateAudioLevel();

    console.log(`[AudioService] Capture started at ${this.inputSampleRate}Hz`);

    // Return the sample rate for immediate use (like working example)
    return this.inputSampleRate;
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
    this.audioBuffer = [];
    this.totalSamples = 0;
    this.audioLevelCallback?.(0);

    console.log('[AudioService] Capture stopped');
  }

  getSampleRate(): number {
    return this.inputSampleRate;
  }

  async playAudio(base64Audio: string): Promise<void> {
    try {
      // Create playback context if needed (use native sample rate for playback)
      if (!this.playbackContext || this.playbackContext.state === 'closed') {
        this.playbackContext = new AudioContext();
      }

      // Resume if suspended (browser autoplay policy)
      if (this.playbackContext.state === 'suspended') {
        await this.playbackContext.resume();
      }

      // Decode base64 PCM16 to Float32
      const float32 = this.base64PCM16ToFloat32(base64Audio);

      // Add to playback queue
      this.playbackQueue.push(float32);

      // Start playback if not already playing
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.playNextChunk();
      }
    } catch (error) {
      console.error('[AudioService] Error playing audio:', error);
    }
  }

  private playNextChunk(): void {
    if (!this.playbackContext || this.playbackQueue.length === 0) {
      this.isPlaying = false;
      this.currentPlaybackSource = null;
      return;
    }

    const chunk = this.playbackQueue.shift()!;
    // Use the sample rate that the audio was encoded at (same as input rate we configured)
    // This ensures proper playback even if playback context has different native rate
    const audioBuffer = this.playbackContext.createBuffer(1, chunk.length, this.inputSampleRate);
    audioBuffer.getChannelData(0).set(chunk);

    const source = this.playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackContext.destination);

    // Store reference for interruption handling
    this.currentPlaybackSource = source;

    source.onended = () => {
      if (this.currentPlaybackSource === source) {
        this.currentPlaybackSource = null;
      }
      this.playNextChunk();
    };

    source.start();
  }

  stopPlayback(): void {
    // Stop currently playing audio source
    if (this.currentPlaybackSource) {
      try {
        this.currentPlaybackSource.stop();
        this.currentPlaybackSource.disconnect();
      } catch {
        // Source may already be stopped
      }
      this.currentPlaybackSource = null;
    }

    // Clear the playback queue
    this.playbackQueue = [];
    this.isPlaying = false;
    console.log('[AudioService] Playback stopped (interrupted)');
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

  // Convert Float32Array to base64-encoded PCM16 (matches working example)
  private floatArrayToBase64PCM16(floatArray: Float32Array): string {
    const pcm16 = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArray[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return this.arrayBufferToBase64(pcm16.buffer);
  }

  // Convert base64 PCM16 to Float32Array for playback (matches working example)
  private base64PCM16ToFloat32(base64: string): Float32Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32;
  }

  // Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  getIsCapturing(): boolean {
    return this.isCapturing;
  }
}

export const audioService = new AudioService();

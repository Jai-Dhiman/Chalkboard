type AudioLevelCallback = (level: number) => void;
type AudioChunkCallback = (chunk: string) => void;

class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private audioChunkCallback: AudioChunkCallback | null = null;
  private animationFrameId: number | null = null;
  private isCapturing = false;

  // Playback
  private playbackQueue: ArrayBuffer[] = [];
  private isPlaying = false;

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      throw new Error('Microphone permission denied');
    }
  }

  async startCapture(
    onAudioLevel: AudioLevelCallback,
    onAudioChunk: AudioChunkCallback
  ): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    this.audioLevelCallback = onAudioLevel;
    this.audioChunkCallback = onAudioChunk;

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Analyser for audio level visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    // Processor for audio chunks (using deprecated ScriptProcessorNode for broader compatibility)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const base64Chunk = this.floatArrayToBase64(inputData);
      this.audioChunkCallback?.(base64Chunk);
    };
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.isCapturing = true;
    this.updateAudioLevel();
  }

  stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

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
  }

  async playAudio(base64Audio: string): Promise<void> {
    const arrayBuffer = this.base64ToArrayBuffer(base64Audio);
    this.playbackQueue.push(arrayBuffer);

    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }

  private async processPlaybackQueue(): Promise<void> {
    if (this.playbackQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.playbackQueue.shift()!;

    try {
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        audioContext.close();
        this.processPlaybackQueue();
      };

      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
      this.processPlaybackQueue();
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

  private floatArrayToBase64(floatArray: Float32Array): string {
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

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  getIsCapturing(): boolean {
    return this.isCapturing;
  }
}

export const audioService = new AudioService();

/**
 * Voice input with two engines, tried in order:
 *
 * 1. Web Speech API (SpeechRecognition) — instant, live transcript, but needs
 *    the browser vendor's cloud speech service. Fails with "network" in
 *    embedded browsers (e.g. app webviews) even when the page itself is online.
 * 2. Local Whisper via @huggingface/transformers (WASM) — runs entirely in the
 *    browser, no cloud service needed. Records with MediaRecorder, then
 *    transcribes. The ~40 MB model is downloaded once and cached by the
 *    browser.
 *
 * Either way the caller gets a transcript string, then the shared extractor
 * turns it into transaction fields.
 */

import { extractTransactionData, type ExtractedTransaction } from "./transactionExtractor";

export type VoiceTransactionData = ExtractedTransaction;

export interface StartListeningOptions {
  /** BCP-47 language tag for the native engine. Defaults to Indian English. */
  lang?: string;
  /** Called repeatedly with the live (partial + final) transcript. */
  onInterim?: (text: string) => void;
  /** Called with progress/status messages (model download, transcribing...). */
  onStatus?: (status: string) => void;
}

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognition) | null;
}

/** Web Speech error codes that mean "engine unavailable", not "user/mic problem". */
const RECOVERABLE_CODES = new Set([
  "network",
  "service-not-allowed",
  "not-available",
  "language-not-supported",
]);

function speechError(code: string): Error & { code: string } {
  const messages: Record<string, string> = {
    "not-allowed": "Microphone permission denied. Allow microphone access for this site and try again.",
    "service-not-allowed": "The browser's speech service is unavailable — switching to the offline engine.",
    "no-speech": "Didn't hear anything. Tap the mic and speak a little louder.",
    "audio-capture": "No microphone found. Please connect one and try again.",
    network: "The browser's speech service is unreachable — switching to the offline engine.",
    "not-available": "The browser's speech engine is unavailable — switching to the offline engine.",
    aborted: "Listening was cancelled.",
  };
  const err = new Error(messages[code] ?? `Voice recognition failed (${code}).`) as Error & { code: string };
  err.code = code;
  return err;
}

class VoiceProcessor {
  private recognition: SpeechRecognition | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private discardRecording = false;
  /** Cached Whisper ASR pipeline (null until first offline transcription). */
  private whisper: { transcribe: (audio: Float32Array) => Promise<Array<{ text?: string }> | { text?: string }> } | null = null;

  private mode: "idle" | "webspeech" | "whisper" = "idle";

  get isListening(): boolean {
    return this.mode !== "idle";
  }

  /** Voice input works if the native engine exists, or we can record audio. */
  isSupported(): boolean {
    if (getRecognitionCtor()) return true;
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  }

  startListening(options: StartListeningOptions = {}): Promise<string> {
    if (this.mode !== "idle") {
      return Promise.reject(new Error("Already listening. Stop the current recording first."));
    }

    if (getRecognitionCtor()) {
      return this.startWebSpeech(options).catch((error) => {
        const code = (error as { code?: string })?.code;
        if (RECOVERABLE_CODES.has(code ?? "") && this.mode === "idle") {
          options.onStatus?.("Switching to the offline speech engine...");
          return this.startWhisperRecording(options);
        }
        throw error;
      });
    }

    return this.startWhisperRecording(options);
  }

  // -------------------------------------------------------------------------
  // Engine 1: native Web Speech API
  // -------------------------------------------------------------------------

  private startWebSpeech(options: StartListeningOptions): Promise<string> {
    const Ctor = getRecognitionCtor()!;
    const recognition = new Ctor();
    this.recognition = recognition;
    this.mode = "webspeech";

    return new Promise<string>((resolve, reject) => {
      let finalText = "";
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        this.mode = "idle";
        this.recognition = null;
        fn();
      };

      recognition.lang = options.lang ?? "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += `${result[0].transcript} `;
          } else {
            interim += result[0].transcript;
          }
        }
        options.onInterim?.((finalText + interim).trim());
      };

      recognition.onerror = (event: { error: string }) => {
        settle(() => reject(speechError(event.error)));
      };

      recognition.onend = () => {
        settle(() => {
          const text = finalText.trim();
          if (text) {
            resolve(text);
          } else {
            reject(speechError("no-speech"));
          }
        });
      };

      try {
        recognition.start();
      } catch {
        settle(() => reject(speechError("not-available")));
      }
    });
  }

  // -------------------------------------------------------------------------
  // Engine 2: record audio + local Whisper transcription
  // -------------------------------------------------------------------------

  private async startWhisperRecording(options: StartListeningOptions): Promise<string> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Audio recording is not supported in this browser.");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Error("Microphone permission denied. Allow microphone access for this site and try again.");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new Error("No microphone found. Please connect one and try again.");
      }
      throw new Error("Could not access the microphone. Please try again.");
    }

    this.stream = stream;
    this.discardRecording = false;
    const recorder = new MediaRecorder(stream);
    this.recorder = recorder;
    this.mode = "whisper";
    options.onStatus?.("Listening... tap Stop when done");

    const chunks: Blob[] = [];

    return new Promise<string>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () => {
        this.cleanupRecording();
        reject(new Error("Recording failed. Please try again."));
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        this.cleanupRecording();
        if (this.discardRecording) {
          reject(speechError("aborted"));
          return;
        }
        try {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size < 2000) {
            throw new Error(speechError("no-speech").message);
          }
          options.onStatus?.("Transcribing...");
          const text = await this.transcribeAudioBlob(blob, options.onStatus);
          if (!text) {
            throw new Error(speechError("no-speech").message);
          }
          resolve(text);
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Could not process your recording."));
        }
      };

      try {
        recorder.start();
      } catch {
        this.cleanupRecording();
        reject(new Error("Could not start recording. Please try again."));
      }
    });
  }

  private cleanupRecording(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.mode = "idle";
  }

  /**
   * Decode an audio blob to 16 kHz mono and transcribe it with the in-browser
   * Whisper model. Public so it can be exercised/tested independently.
   */
  async transcribeAudioBlob(blob: Blob, onStatus?: (status: string) => void): Promise<string> {
    onStatus?.("Preparing audio...");
    const AudioCtor =
      (window as unknown as Record<string, unknown>).AudioContext as typeof AudioContext | undefined;
    if (!AudioCtor) throw new Error("Audio processing is not supported in this browser.");

    const arrayBuffer = await blob.arrayBuffer();
    let audio: Float32Array<ArrayBuffer>;
    {
      const ctx = new AudioCtor({ sampleRate: 16000 });
      try {
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        // Mix down to mono
        if (decoded.numberOfChannels > 1) {
          const length = decoded.length;
          const mono = new Float32Array(length);
          for (let c = 0; c < decoded.numberOfChannels; c++) {
            const data = decoded.getChannelData(c);
            for (let i = 0; i < length; i++) mono[i] += data[i] / decoded.numberOfChannels;
          }
          audio = mono;
        } else {
          audio = new Float32Array(decoded.getChannelData(0));
        }
        // Resample to 16 kHz if the context didn't already
        if (Math.abs(decoded.sampleRate - 16000) > 1) {
          const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
          const buffer = offline.createBuffer(1, audio.length, decoded.sampleRate);
          buffer.copyToChannel(audio, 0);
          const source = offline.createBufferSource();
          source.buffer = buffer;
          source.connect(offline.destination);
          source.start();
          const rendered = await offline.startRendering();
          audio = new Float32Array(rendered.getChannelData(0));
        }
      } finally {
        void ctx.close();
      }
    }

    onStatus?.("Loading speech model (first time only)...");
    if (!this.whisper) {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      const asr = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p?.status === "progress" && typeof p.progress === "number") {
            onStatus?.(`Loading speech model... ${Math.round(p.progress)}%`);
          }
        },
      });
      this.whisper = {
        transcribe: (audio: Float32Array) =>
          (asr as unknown as (a: Float32Array) => Promise<Array<{ text?: string }> | { text?: string }>)(audio),
      };
    }

    onStatus?.("Transcribing...");
    const output = await this.whisper.transcribe(audio);
    const result = Array.isArray(output) ? output[0]?.text : output?.text;
    return (result ?? "").trim();
  }

  // -------------------------------------------------------------------------

  /** Stops listening; the pending startListening() promise then resolves. */
  stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // recognition already ended
      }
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // recorder already stopped
      }
    }
  }

  /** Hard-cancels any session (e.g. on dialog close/unmount) without processing. */
  abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // recognition already ended
      }
      this.recognition = null;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      this.discardRecording = true;
      try {
        this.recorder.stop();
      } catch {
        // recorder already stopped
      }
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.recorder = null;
    this.mode = "idle";
  }

  extractTransactionData(transcript: string): VoiceTransactionData {
    return extractTransactionData(transcript, "voice");
  }

  async extractTransactionDataAI(transcript: string): Promise<VoiceTransactionData> {
    const parserApi = import.meta.env.VITE_PARSER_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
    try {
      const resp = await fetch(`${parserApi}/parse-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result && typeof result === "object") {
          return {
            amount: result.amount !== null ? Number(result.amount) : null,
            type: result.transaction_type === "income" ? "income" : "expense",
            category: result.category || "Misc",
            merchant: result.merchant_name || "",
            description: result.description || transcript,
            paymentMethod: result.payment_method || "UPI",
            date: result.transaction_date || null,
            time: result.transaction_time || null,
            confidence: typeof result.confidence === "number" ? result.confidence : 0.9,
          };
        }
      }
    } catch (err) {
      console.info("AI voice parser unavailable, using local rules:", err);
    }
    return this.extractTransactionData(transcript);
  }
}


export const voiceProcessor = new VoiceProcessor();

/**
 * Client-side receipt scanning: Tesseract.js OCR in the browser, then shared
 * text extraction. Works without any backend server (the previous
 * Python-only pipeline required multi-GB torch models and silently fell back
 * to fake data when it wasn't running).
 *
 * Real phone photos are auto-resized/compressed before OCR — they are often
 * several MB, which the old code rejected outright and which OCR handles
 * slowly. The scanner worker is preloaded so the first scan is fast.
 */

import { extractTransactionData, type ExtractedTransaction } from "./transactionExtractor";

/** Hard cap — anything bigger is still accepted and resized, this is only abuse protection. */
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"];
/** Receipts stay legible at 1600px on the long edge; OCR gets much faster. */
const MAX_OCR_EDGE = 1600;

export interface ImageTransactionData extends ExtractedTransaction {
  /** Raw OCR text so the user can see what was read. */
  text: string;
}

export function validateImageFile(file: File): void {
  if (!file.type || !ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    throw new Error("Please choose a JPEG, PNG, WebP or BMP image. (If your phone saves HEIC, switch the camera to JPEG.)");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image is too large (over 20 MB). Please choose a smaller photo.");
  }
}

type TesseractLoggerMessage = { status: string; progress: number };
type TesseractWorker = {
  recognize: (image: File | Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

// A single worker is created once and reused for every scan; the tesseract.js
// core + English language data (a few MB) are only downloaded on first use.
let workerPromise: Promise<TesseractWorker> | null = null;
let activeLogger: ((m: TesseractLoggerMessage) => void) | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng", 1, {
        logger: (m: TesseractLoggerMessage) => activeLogger?.(m),
      }) as unknown as Promise<TesseractWorker>;
    })();
  }
  return workerPromise;
}

/** Warm up the OCR engine (call when the Image tab is opened). */
export function preloadScanner(): void {
  getWorker().catch(() => {
    // First explicit scan will surface the error with a proper message.
    workerPromise = null;
  });
}

/** Resize/compress big photos so OCR is fast and reliable. */
async function prepareImage(file: File | Blob): Promise<File | Blob> {
  if (typeof createImageBitmap === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    // from-image honours EXIF rotation so portrait phone photos come out upright
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // undecodable via bitmap — let OCR try the raw bytes
  }
  try {
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_OCR_EDGE / longestEdge);
    if (scale === 1 && file.size <= 4 * 1024 * 1024) return file;

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ?? file;
  } finally {
    bitmap.close?.();
  }
}

function describeTesseractStatus(status: string, progress: number): string {
  switch (status) {
    case "loading tesseract core":
      return "Loading scanner...";
    case "initializing tesseract":
      return "Starting scanner...";
    case "loading language traineddata":
      return "Loading language data...";
    case "initializing api":
      return "Preparing scanner...";
    case "recognizing text":
      return `Scanning receipt... ${Math.round(progress * 100)}%`;
    default:
      return "Processing...";
  }
}

export async function extractTransactionFromImage(
  file: File,
  onStatus?: (status: string) => void,
): Promise<ImageTransactionData> {
  // 1. Try AI Multimodal Vision Server (OpenAI & Google models)
  const parserApi = import.meta.env.VITE_PARSER_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  try {
    onStatus?.("Analyzing receipt with AI (OpenAI & Google vision)...");
    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const resp = await fetch(`${parserApi}/parse-image`, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const result = await resp.json();
      if (result && typeof result === "object" && (result.amount !== null || result.merchant_name)) {
        return {
          amount: result.amount !== null ? Number(result.amount) : null,
          type: result.transaction_type === "income" ? "income" : "expense",
          category: result.category || "Misc",
          merchant: result.merchant_name || "",
          description: result.description || "Receipt scanned with AI",
          paymentMethod: result.payment_method || "UPI",
          date: result.transaction_date || null,
          time: result.transaction_time || null,
          confidence: typeof result.confidence === "number" ? result.confidence : 0.95,
          text: result.description || `AI Extraction: ₹${result.amount || 0} at ${result.merchant_name || 'Merchant'}`
        };
      }
    }
  } catch (apiErr) {
    console.info("AI vision server unavailable, falling back to local OCR scanner:", apiErr);
  }

  // 2. Client-side OCR Fallback (Tesseract.js)
  try {
    onStatus?.("Preparing image...");
    const prepared = await prepareImage(file);

    const worker = await getWorker();
    activeLogger = (m) => onStatus?.(describeTesseractStatus(m.status, m.progress));

    const { data } = await worker.recognize(prepared);
    const text = (data.text || "").replace(/\s+/g, " ").trim();

    if (text.length < 5) {
      throw new Error(
        "Couldn't read any text from this image. Retake the photo with good lighting and make sure the receipt text is sharp and fills the frame.",
      );
    }

    const extracted = extractTransactionData(text, "image");
    return { ...extracted, text };
  } catch (error) {
    if (error instanceof Error && error.message.includes("read any text")) throw error;
    throw new Error(
      error instanceof Error
        ? `Failed to scan the image: ${error.message}`
        : "Failed to scan the image. Please try again.",
    );
  } finally {
    activeLogger = null;
  }
}


export const imageProcessor = {
  validateImageFile,
  extractTransactionFromImage,
  preloadScanner,
};

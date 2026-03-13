// Buffer polyfill for browser environment
import { Buffer } from 'buffer';

// Polyfill Buffer for global access
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as Record<string, unknown>).Buffer = Buffer;
}

export { Buffer };

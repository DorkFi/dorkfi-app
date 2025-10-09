// Buffer polyfill for browser environment
import { Buffer } from 'buffer';

// Polyfill Buffer for global access
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

export { Buffer };

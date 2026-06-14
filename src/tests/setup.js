import { vi } from 'vitest';
import crypto from 'crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => crypto.randomUUID()
    },
    writable: true
  });
} else if (typeof globalThis.crypto.randomUUID === 'undefined') {
  globalThis.crypto.randomUUID = () => crypto.randomUUID();
}

function createStorageMock() {
  const store = new Map();
  return {
    getItem: vi.fn((key) => (store.has(key) ? String(store.get(key)) : null)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index) => [...store.keys()][index] || null),
    get length() { return store.size; },
    _store: store,
    _reset() { store.clear(); vi.clearAllMocks(); }
  };
}

const LS = createStorageMock();
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: LS, writable: true });
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: LS };
} else if (!globalThis.window.localStorage) {
  globalThis.window.localStorage = LS;
}

globalThis._storageMock = LS;

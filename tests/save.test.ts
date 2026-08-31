import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSave, loadSave, resetMemorySave, SAVE_KEY, savePersistence, writeSave } from '../src/domain/save';

class MockStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  get length(): number {
    throw new Error('denied');
  }
  clear(): void {
    throw new Error('denied');
  }
  getItem(): string | null {
    throw new Error('denied');
  }
  key(): string | null {
    throw new Error('denied');
  }
  removeItem(): void {
    throw new Error('denied');
  }
  setItem(): void {
    throw new Error('denied');
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetMemorySave();
});

describe('save round-trip', () => {
  it('writeSave then loadSave returns the same data', () => {
    const storage = new MockStorage();
    vi.stubGlobal('localStorage', storage);
    const save = defaultSave();
    save.progress.learn[0] = 87;
    save.settings.sound = false;
    writeSave(save);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
    const loaded = loadSave();
    expect(loaded).toEqual(save);
    expect(savePersistence.persisted).toBe(true);
  });
});

describe('corrupt or future saves yield defaults', () => {
  it('corrupt JSON → default', () => {
    const storage = new MockStorage();
    storage.setItem(SAVE_KEY, '{not json');
    vi.stubGlobal('localStorage', storage);
    expect(loadSave()).toEqual(defaultSave());
  });

  it('version 2 blob → default', () => {
    const storage = new MockStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, settings: {}, progress: {} }));
    vi.stubGlobal('localStorage', storage);
    expect(loadSave()).toEqual(defaultSave());
  });

  it('missing key → default', () => {
    vi.stubGlobal('localStorage', new MockStorage());
    expect(loadSave()).toEqual(defaultSave());
  });
});

describe('throwing localStorage → in-memory fallback', () => {
  it('loads a session save and flags persisted=false', () => {
    vi.stubGlobal('localStorage', new ThrowingStorage());
    const first = loadSave();
    expect(first).toEqual(defaultSave());
    first.progress.learn[4] = 91;
    writeSave(first);
    expect(savePersistence.persisted).toBe(false);
    const second = loadSave();
    expect(second.progress.learn[4]).toBe(91);
    expect(second).toBe(first);
  });
});

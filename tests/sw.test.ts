import { describe, it, expect } from 'vitest';
import { runChecks } from '../src/diagnostics';

describe('smoke', () => {
  it('diagnostics module loads', () => { expect(typeof runChecks).toBe('function'); });
  it('indexeddb exists in test env', () => { expect(typeof indexedDB.open).toBe('function'); });
});

import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('returns message for Error instance', () => {
    expect(getErrorMessage(new Error('Something failed'))).toBe('Something failed');
  });

  it('returns string when given a string', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('returns stringified value for other objects', () => {
    expect(getErrorMessage({ code: 'ERR' })).toBe('{"code":"ERR"}');
  });

  it('returns "Unknown error" for non-serializable value', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(getErrorMessage(circular)).toBe('Unknown error');
  });
});

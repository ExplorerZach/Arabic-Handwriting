import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeString, applyBackup } from '../backup.js';

describe('sanitizeString', () => {
  it('strips HTML tags', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeString('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeString('<b>hello</b>')).toBe('hello');
    expect(sanitizeString('<a href="x" onclick="evil()">click</a>')).toBe('click');
  });

  it('leaves plain text unchanged', () => {
    expect(sanitizeString('hello world')).toBe('hello world');
    expect(sanitizeString('Arabic text مرحبا')).toBe('Arabic text مرحبا');
  });

  it('returns non-string values as-is', () => {
    expect(sanitizeString(123)).toBe(123);
    expect(sanitizeString(null)).toBe(null);
    expect(sanitizeString(undefined)).toBe(undefined);
  });

  it('handles nested and malformed tags', () => {
    expect(sanitizeString('<div><span>text</span></div>')).toBe('text');
    expect(sanitizeString('<unclosed>text')).toBe('text');
  });
});

describe('applyBackup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects invalid input', () => {
    expect(applyBackup(null).ok).toBe(false);
    expect(applyBackup(undefined).ok).toBe(false);
    expect(applyBackup('string').ok).toBe(false);
    expect(applyBackup({}).ok).toBe(false);
    expect(applyBackup({ format: 'wrong', data: {} }).ok).toBe(false);
  });

  it('writes valid keys to localStorage', () => {
    const backup = {
      format: 'arabic-handwriting-backup',
      version: 1,
      data: {
        brushScale: '8',
        lessonMode: 'true',
        app_locale: 'en',
      },
    };
    const result = applyBackup(backup);
    expect(result.ok).toBe(true);
    expect(result.imported).toBe(3);
    expect(localStorage.getItem('brushScale')).toBe('8');
    expect(localStorage.getItem('lessonMode')).toBe('true');
    expect(localStorage.getItem('app_locale')).toBe('en');
  });

  it('sanitizes XSS payloads in string values', () => {
    const backup = {
      format: 'arabic-handwriting-backup',
      version: 1,
      data: {
        arabic_decks: '[{"name":"<img src=x onerror=alert(1)>","items":[],"order":0}]',
        app_locale: 'en',
        brushScale: '10',
      },
    };
    applyBackup(backup);

    const stored = localStorage.getItem('arabic_decks');
    expect(stored).not.toContain('<img');
    expect(stored).not.toContain('onerror');
    expect(stored).toContain('"name":""');
  });

  it('skips non-string values', () => {
    const backup = {
      format: 'arabic-handwriting-backup',
      version: 1,
      data: {
        app_locale: 'en',
        brushScale: null,
        skipped: 42,
      },
    };
    const result = applyBackup(backup);
    expect(result.ok).toBe(true);
    expect(result.imported).toBe(1);
  });
});

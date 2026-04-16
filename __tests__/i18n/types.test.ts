import {
  SUPPORTED_LOCALES,
  SSR_INITIAL_LOCALE,
  NAVIGATOR_UNAVAILABLE_FALLBACK,
  MESSAGE_FALLBACK_LOCALE,
} from '@/i18n/types';
import type { Locale } from '@/i18n/types';

describe('i18n/types', () => {
  describe('Locale 型', () => {
    it('Locale 型として "ja" を割り当てられること', () => {
      const locale: Locale = 'ja';
      expect(locale).toBe('ja');
    });

    it('Locale 型として "en" を割り当てられること', () => {
      const locale: Locale = 'en';
      expect(locale).toBe('en');
    });
  });

  describe('SUPPORTED_LOCALES', () => {
    it('要素数が 2 であること', () => {
      expect(SUPPORTED_LOCALES).toHaveLength(2);
    });

    it('"ja" を含むこと', () => {
      expect(SUPPORTED_LOCALES).toContain('ja');
    });

    it('"en" を含むこと', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
    });

    it('順序が ["ja", "en"] であること', () => {
      expect(SUPPORTED_LOCALES[0]).toBe('ja');
      expect(SUPPORTED_LOCALES[1]).toBe('en');
    });
  });

  describe('SSR_INITIAL_LOCALE', () => {
    it('"en" であること', () => {
      expect(SSR_INITIAL_LOCALE).toBe('en');
    });
  });

  describe('NAVIGATOR_UNAVAILABLE_FALLBACK', () => {
    it('"ja" であること', () => {
      expect(NAVIGATOR_UNAVAILABLE_FALLBACK).toBe('ja');
    });
  });

  describe('MESSAGE_FALLBACK_LOCALE', () => {
    it('"en" であること', () => {
      expect(MESSAGE_FALLBACK_LOCALE).toBe('en');
    });
  });
});

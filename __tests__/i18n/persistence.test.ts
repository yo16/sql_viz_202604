import { readSavedLocale, writeSavedLocale } from '@/i18n/persistence';

describe('i18n/persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('writeSavedLocale', () => {
    it('"ja" を保存できること', () => {
      writeSavedLocale('ja');
      expect(localStorage.getItem('sql-viz-locale')).toBe('ja');
    });

    it('"en" を保存できること', () => {
      writeSavedLocale('en');
      expect(localStorage.getItem('sql-viz-locale')).toBe('en');
    });

    it('localStorage が使えない場合でも例外を投げないこと', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => writeSavedLocale('ja')).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('readSavedLocale', () => {
    it('保存された "ja" を読み取れること', () => {
      localStorage.setItem('sql-viz-locale', 'ja');
      expect(readSavedLocale()).toBe('ja');
    });

    it('保存された "en" を読み取れること', () => {
      localStorage.setItem('sql-viz-locale', 'en');
      expect(readSavedLocale()).toBe('en');
    });

    it('未保存の場合は null を返すこと', () => {
      expect(readSavedLocale()).toBeNull();
    });

    it('無効な値が保存されている場合は null を返すこと', () => {
      localStorage.setItem('sql-viz-locale', 'zh');
      expect(readSavedLocale()).toBeNull();
    });

    it('空文字が保存されている場合は null を返すこと', () => {
      localStorage.setItem('sql-viz-locale', '');
      expect(readSavedLocale()).toBeNull();
    });

    it('localStorage が使えない場合は null を返すこと', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(readSavedLocale()).toBeNull();
      spy.mockRestore();
    });
  });

  describe('roundtrip', () => {
    it('writeSavedLocale で保存した値を readSavedLocale で読み取れること', () => {
      writeSavedLocale('en');
      expect(readSavedLocale()).toBe('en');
      writeSavedLocale('ja');
      expect(readSavedLocale()).toBe('ja');
    });
  });
});

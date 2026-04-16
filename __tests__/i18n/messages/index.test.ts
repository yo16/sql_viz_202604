import { messages, getMessages, ja, en } from '@/i18n/messages';
import type { Messages } from '@/i18n/messages';
import { ja as jaSource } from '@/i18n/messages/ja';
import { en as enSource } from '@/i18n/messages/en';

describe('i18n/messages/index', () => {
  describe('messages マップ', () => {
    it('ja/en の2キーを持つ', () => {
      expect(Object.keys(messages).sort()).toEqual(['en', 'ja']);
    });

    it('messages.ja が ja モジュールと同一参照', () => {
      expect(messages.ja).toBe(jaSource);
    });

    it('messages.en が en モジュールと同一参照', () => {
      expect(messages.en).toBe(enSource);
    });
  });

  describe('getMessages', () => {
    it('"ja" で日本語リソースを返す', () => {
      expect(getMessages('ja')).toBe(jaSource);
    });

    it('"en" で英語リソースを返す', () => {
      expect(getMessages('en')).toBe(enSource);
    });

    it('返り値の header.title が "SQL Lineage Viz"（両言語固定）', () => {
      expect(getMessages('ja').header.title).toBe('SQL Lineage Viz');
      expect(getMessages('en').header.title).toBe('SQL Lineage Viz');
    });

    it('返り値の翻訳対象キーが locale ごとに異なる', () => {
      expect(getMessages('ja').button.expandAll).toBe('全部開く');
      expect(getMessages('en').button.expandAll).toBe('Expand all');
    });
  });

  describe('re-export', () => {
    it('ja を index 経由で import できる', () => {
      expect(ja).toBe(jaSource);
    });

    it('en を index 経由で import できる', () => {
      expect(en).toBe(enSource);
    });

    it('Messages 型として ja/en を代入可能', () => {
      const j: Messages = ja;
      const e: Messages = en;
      expect(j).toBe(jaSource);
      expect(e).toBe(enSource);
    });
  });
});

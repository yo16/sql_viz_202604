"use client";

import { useLocale } from '@/i18n/useLocale';
import styles from './Footer.module.css';

/**
 * フッター。提供元情報と問い合わせリンクを表示する。
 *
 * 設計: doc/design/i18n.md §9 (useLocale 化方針), §6.4 (翻訳インベントリ)
 * - "Small Piece" / "Contact" は英語固定 (t.footer.providerName / t.footer.contactLabel、両言語で同値)
 * - 周辺文言 (お気軽に〜からお問い合わせください / Feel free to 〜 us) は翻訳対象
 */
export function Footer() {
  const { t } = useLocale();

  return (
    <footer className={styles.footer}>
      <span>
        &copy;{' '}
        <a
          href="https://smallpiece.jp/?utm_source=sql-viz&utm_medium=referral&utm_campaign=footer"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {t.footer.providerName}
        </a>
      </span>
      <span className={styles.separator}>|</span>
      <span>
        {t.footer.contactSentencePrefix}
        <a
          href="https://smallpiece.jp/contact?utm_source=sql-viz&utm_medium=referral&utm_campaign=footer_contact"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {t.footer.contactLabel}
        </a>
        {t.footer.contactSentenceSuffix}
      </span>
    </footer>
  );
}

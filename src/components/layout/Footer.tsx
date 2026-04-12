import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>
        &copy; <a href="https://smallpiece.jp/?utm_source=sql-viz&utm_medium=referral&utm_campaign=footer" target="_blank" rel="noopener noreferrer" className={styles.link}>Small Piece</a>
      </span>
      <span className={styles.separator}>|</span>
      <span>
        お気軽に<a href="https://smallpiece.jp/contact?utm_source=sql-viz&utm_medium=referral&utm_campaign=footer_contact" target="_blank" rel="noopener noreferrer" className={styles.link}>お問い合わせ</a>ください
      </span>
    </footer>
  );
}

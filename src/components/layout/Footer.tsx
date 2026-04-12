import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>
        &copy; <a href="https://smallpiece.jp/" target="_blank" rel="noopener noreferrer" className={styles.link}>Small Piece</a>
      </span>
      <span className={styles.separator}>|</span>
      <span>
        自社環境への導入については<a href="https://smallpiece.jp/contact" target="_blank" rel="noopener noreferrer" className={styles.link}>お問い合わせ</a>ください
      </span>
    </footer>
  );
}

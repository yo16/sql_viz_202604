import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>SQL Visualizer</h1>
        <p>SQL lineage visualizer</p>
      </main>
    </div>
  );
}

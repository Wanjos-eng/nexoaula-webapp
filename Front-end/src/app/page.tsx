import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="page-title">
        <p className={styles.eyebrow}>nexoAula</p>
        <h1 id="page-title">Fundação do frontend pronta para evoluir.</h1>
        <p className={styles.description}>
          Aplicação Next.js inicial do monorepositório. As jornadas do produto
          serão implementadas nas próximas tasks do backlog.
        </p>

        <dl className={styles.details}>
          <div>
            <dt>Estado</dt>
            <dd>Sprint 1</dd>
          </div>
          <div>
            <dt>Stack</dt>
            <dd>Next.js · TypeScript</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

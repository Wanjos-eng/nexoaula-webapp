"use client";

import Link from "next/link";
import { useState } from "react";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import { marketplaceApi, marketplaceError, marketplacePath, type SessionOffer } from "@/modules/marketplace/marketplace.api";
import { formatCents, type TutorProfile } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

export default function TutorPage() {
  const profile = useMarketplace<TutorProfile | null>(`${marketplacePath}/tutor`);
  const [offset, setOffset] = useState(0);
  const offers = useMarketplace<SessionOffer[]>(`${marketplacePath}/sessions/mine?limit=20&offset=${offset}`);
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); setEditing(false); profile.refresh(); offers.refresh(); }
    catch (error) { setError(marketplaceError(error)); }
    finally { setBusy(false); }
  }
  const active = profile.data?.status === "active";
  return <main className={styles.page}>
    <header className={styles.header}>
      <h1 className={styles.title}>Meu perfil profissional</h1>
      <p className={styles.subtitle}>Ative seu perfil para criar e publicar sessões de tutoria.</p>
      <p className={styles.simulationBanner} role="note">Demonstração acadêmica. Nenhum pagamento real será realizado.</p>
    </header>
    {error && <p role="alert">{error}</p>}
    <section className={styles.section} aria-labelledby="profile-heading">
      <h2 id="profile-heading">Perfil profissional</h2>
      {profile.loading ? <p role="status">Carregando perfil…</p> : profile.error ? <p role="alert">{profile.error} <button onClick={profile.refresh}>Tentar novamente</button></p> : editing ?
        <form className={styles.profileForm} onSubmit={(e) => { e.preventDefault(); void mutate(() => marketplaceApi.activate(headline, bio)); }}>
          <label className={styles.field}>Título profissional<input required maxLength={200} value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
          <label className={styles.field}>Bio (opcional)<textarea maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
          <button className={styles.activateButton} disabled={busy}>Confirmar ativação</button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
        </form> : <div className={styles.activationCard}>
          <p role="status">{active ? profile.data?.headline || "Perfil profissional ativo" : profile.data?.status === "suspended" ? "Perfil suspenso" : profile.data?.status === "paused" ? "Perfil pausado" : "Você ainda não ativou seu perfil profissional."}</p>
          {profile.data?.bio && <p>{profile.data.bio}</p>}
          {active ? <button disabled={busy} onClick={() => mutate(marketplaceApi.pause)}>Pausar perfil</button> : profile.data?.status !== "suspended" && <button className={styles.activateButton} disabled={busy} onClick={() => { setHeadline(profile.data?.headline ?? ""); setBio(profile.data?.bio ?? ""); setEditing(true); }}>{profile.data ? "Retomar perfil profissional" : "Ativar perfil profissional"}</button>}
        </div>}
    </section>
    <section className={styles.section} aria-labelledby="sessions-heading">
      <div className={styles.sectionHeader}><h2 id="sessions-heading">Minhas sessões</h2>{active && <Link className={styles.newButton} href="/tutor/nova-sessao">Nova sessão</Link>}</div>
      {offers.loading ? <p role="status">Carregando ofertas…</p> : offers.error ? <p role="alert">{offers.error} <button onClick={offers.refresh}>Tentar novamente</button></p> : !offers.data?.length ? <p>Nenhuma sessão criada ainda.</p> : <ul className={styles.bookingList}>
        {offers.data.map((offer) => <li key={offer.id} className={styles.bookingCard}>
          <div><h3>{offer.title}</h3><p>{({ draft: "Rascunho", scheduled: "Publicada", cancelled: "Cancelada", completed: "Concluída" })[offer.status]}</p><p>{new Date(offer.starts_at).toLocaleString("pt-BR")}</p></div>
          <strong>{formatCents(offer.price_cents)} (simulado)</strong>
          {offer.status === "draft" && active && <button disabled={busy} onClick={() => mutate(() => marketplaceApi.publish(offer.id))}>Publicar sessão</button>}
          {offer.status === "scheduled" && <button disabled={busy} onClick={() => mutate(() => marketplaceApi.cancelOffer(offer.id))}>Cancelar oferta</button>}
        </li>)}
      </ul>}
      <nav aria-label="Paginação de ofertas"><button disabled={offers.loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</button><button disabled={offers.loading || (offers.data?.length ?? 0) < 20} onClick={() => setOffset(offset + 20)}>Próxima</button></nav>
    </section>
    <Link href="/sessoes/minhas">Minhas inscrições</Link>
  </main>;
}

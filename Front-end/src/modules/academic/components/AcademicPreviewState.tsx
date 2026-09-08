import Link from "next/link";

export type AcademicViewState = "ready" | "loading" | "error" | "empty" | "restricted";

export function AcademicPreviewState({ state }: { state: AcademicViewState }) {
  return <section aria-label="Estado da prévia acadêmica">
    <p>Prévia demonstrativa: dados fictícios, sem persistência.</p>
    <p role={state === "loading" ? "status" : "alert"}>
      {state === "loading" ? "Carregando dados acadêmicos…" : "Não foi possível carregar os dados nesta simulação."}
    </p>
    <Link href="/disciplinas">Voltar às disciplinas</Link>
  </section>;
}

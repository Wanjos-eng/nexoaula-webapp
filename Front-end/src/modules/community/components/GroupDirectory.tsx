"use client";

import { MagnifyingGlass, Plus, WarningCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ALL_FILTERS, filterGroups, groupCohort, uniqueSorted } from "../filterGroups";
import type {
  DirectoryStatus,
  GroupFilters as Filters,
  OwnedStudyGroup,
  StudyGroup,
} from "../types";
import { GroupCard } from "./GroupCard";
import { GroupFilters } from "./GroupFilters";
import styles from "./GroupDirectory.module.css";

type DirectoryView = "mine" | "discover";

type GroupDirectoryProps = {
  groups: StudyGroup[];
  initialStatus?: DirectoryStatus;
  initialView?: DirectoryView;
  myGroups: OwnedStudyGroup[];
};

const FOCUSABLE_ELEMENT_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const EMPTY_FILTERS: Filters = {
  query: "",
  discipline: ALL_FILTERS,
  cohort: ALL_FILTERS,
  topic: ALL_FILTERS,
};

export function GroupDirectory({
  groups,
  initialStatus = "ready",
  initialView = "mine",
  myGroups,
}: GroupDirectoryProps) {
  const [view, setView] = useState<DirectoryView>(initialView);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [status, setStatus] = useState<DirectoryStatus>(initialStatus);
  const [preview, setPreview] = useState<StudyGroup | null>(null);
  const closeDialogRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const closePreview = useCallback(() => {
    setPreview(null);
    requestAnimationFrame(() => previewTriggerRef.current?.focus());
  }, []);

  const filteredGroups = useMemo(() => filterGroups(groups, filters), [filters, groups]);
  const disciplines = useMemo(() => uniqueSorted(groups.map((group) => group.discipline)), [groups]);
  const cohorts = useMemo(() => uniqueSorted(groups.map(groupCohort)), [groups]);
  const topics = useMemo(() => uniqueSorted(groups.flatMap((group) => group.topics)), [groups]);

  useEffect(() => {
    if (!preview) return;
    closeDialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleDialogKeys(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closePreview();
        return;
      }

      const dialog = dialogRef.current;
      if (event.key !== "Tab" || !dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const focusLeftDialog = !activeElement || !dialog.contains(activeElement);

      if (event.shiftKey && (activeElement === firstElement || focusLeftDialog)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || focusLeftDialog)) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeys);
    };
  }, [closePreview, preview]);

  function openPreview(group: StudyGroup) {
    previewTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreview(group);
  }

  function selectView(nextView: DirectoryView) {
    setView(nextView);
    setPreview(null);
  }

  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const views: DirectoryView[] = ["mine", "discover"];
    let nextIndex = index;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % views.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = views.length - 1;
    else return;

    event.preventDefault();
    selectView(views[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={styles.directory}>
      <div className={styles.introRow}>
        <div>
          <p className={styles.eyebrow}>Comunidade acadêmica</p>
          <h2>Encontre companhia para estudar</h2>
          <p>Continue nos seus grupos ou descubra comunidades pela disciplina, turma e assunto.</p>
        </div>
        <div aria-label="Resumo de grupos" className={styles.summary}>
          <p>
            <strong>{myGroups.length}</strong>
            <span>{countLabel(myGroups.length, "grupo ativo", "grupos ativos")}</span>
          </p>
          <p>
            <strong>{groups.length}</strong>
            <span>{countLabel(groups.length, "comunidade", "comunidades")}</span>
          </p>
          <p>
            <strong>{disciplines.length}</strong>
            <span>{countLabel(disciplines.length, "disciplina", "disciplinas")}</span>
          </p>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Visualização de grupos">
        <button
          aria-controls="my-groups-panel"
          aria-selected={view === "mine"}
          className={view === "mine" ? styles.tabActive : styles.tab}
          id="my-groups-tab"
          onClick={() => selectView("mine")}
          onKeyDown={(event) => handleTabKeys(event, 0)}
          ref={(element) => { tabRefs.current[0] = element; }}
          role="tab"
          tabIndex={view === "mine" ? 0 : -1}
          type="button"
        >
          Meus grupos <span>{myGroups.length}</span>
        </button>
        <button
          aria-controls="discover-groups-panel"
          aria-selected={view === "discover"}
          className={view === "discover" ? styles.tabActive : styles.tab}
          id="discover-groups-tab"
          onClick={() => selectView("discover")}
          onKeyDown={(event) => handleTabKeys(event, 1)}
          ref={(element) => { tabRefs.current[1] = element; }}
          role="tab"
          tabIndex={view === "discover" ? 0 : -1}
          type="button"
        >
          Descobrir grupos
        </button>
      </div>

      {view === "mine" ? (
        <section aria-labelledby="my-groups-tab" id="my-groups-panel" role="tabpanel" tabIndex={0}>
          <div className={styles.sectionHeading}>
            <div><h3>Seus espaços de estudo</h3><p>Acesse discussões e encontros dos grupos dos quais você participa.</p></div>
          </div>
          {myGroups.length ? (
            <div className={styles.cardGrid}>
              {myGroups.map((group) => <GroupCard group={group} key={group.id} variant="owned" />)}
              <article className={styles.createCard}>
                <span aria-hidden><Plus size={22} /></span>
                <h3>Organize um novo grupo</h3>
                <p>Crie um espaço para reunir sua turma, os assuntos e os próximos encontros.</p>
                <Link href="/grupos/novo">Criar grupo</Link>
              </article>
            </div>
          ) : (
            <EmptyState
              action={<Link href="/grupos/novo">Criar meu primeiro grupo</Link>}
              description="Quando você criar ou participar de uma comunidade, ela aparecerá aqui."
              title="Você ainda não participa de grupos"
            />
          )}
        </section>
      ) : (
        <section aria-labelledby="discover-groups-tab" id="discover-groups-panel" role="tabpanel" tabIndex={0}>
          <GroupFilters
            cohorts={cohorts}
            disciplines={disciplines}
            filters={filters}
            onChange={setFilters}
            topics={topics}
          />

          {status === "loading" ? <LoadingState /> : null}
          {status === "error" ? <ErrorState onRetry={() => setStatus("ready")} /> : null}
          {status === "ready" ? (
            <>
              <div aria-live="polite" className={styles.resultsHeading} role="status">
                <p><strong>{filteredGroups.length}</strong> {filteredGroups.length === 1 ? "comunidade encontrada" : "comunidades encontradas"}</p>
                <span>Dados simulados para validação da interface</span>
              </div>
              {filteredGroups.length ? (
                <div className={styles.cardGrid}>
                  {filteredGroups.map((group) => (
                    <GroupCard group={group} key={group.id} onPreview={openPreview} variant="discover" />
                  ))}
                </div>
              ) : (
                <EmptyState
                  action={<button onClick={() => setFilters(EMPTY_FILTERS)} type="button">Remover filtros e ver todos</button>}
                  description="Ajuste a busca ou remova um dos filtros para ver outras comunidades."
                  title="Nenhum grupo corresponde aos filtros"
                />
              )}
            </>
          ) : null}
        </section>
      )}

      {preview ? (
        <div className={styles.dialogBackdrop} onClick={closePreview} role="presentation">
          <section
            aria-labelledby="group-preview-title"
            aria-modal="true"
            className={styles.dialog}
            onClick={(event) => event.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <button
              aria-label="Fechar detalhes do grupo"
              className={styles.dialogClose}
              onClick={closePreview}
              ref={closeDialogRef}
              type="button"
            >
              <X aria-hidden size={18} />
            </button>
            <p className={styles.eyebrow}>{preview.discipline}</p>
            <h3 id="group-preview-title">{preview.name}</h3>
            <p>{preview.description}</p>
            <dl className={styles.previewFacts}>
              <div><dt>Turma e período</dt><dd>{groupCohort(preview)}</dd></div>
              <div><dt>Participantes</dt><dd>{preview.memberCount} de {preview.capacity}</dd></div>
              <div><dt>Entrada</dt><dd>{preview.entryMode === "open" ? "Livre" : "Mediante aprovação"}</dd></div>
              <div><dt>Próximo encontro</dt><dd>{preview.nextMeeting ?? "Ainda não definido"}</dd></div>
            </dl>
            <p className={styles.previewNote}>A participação real será habilitada quando esta interface for integrada ao backend.</p>
            <button className={styles.dialogAction} onClick={closePreview} type="button">Voltar à descoberta</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function countLabel(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function EmptyState({ action, description, title }: { action: ReactNode; description: string; title: string }) {
  return (
    <div className={styles.emptyState}>
      <MagnifyingGlass aria-hidden size={26} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Carregando comunidades" className={styles.loadingGrid} role="status">
      <span className="sr-only">Carregando comunidades...</span>
      {[0, 1, 2].map((item) => <div className={styles.skeletonCard} key={item} />)}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.errorState} role="alert">
      <WarningCircle aria-hidden size={28} />
      <h3>Não foi possível carregar as comunidades</h3>
      <p>Este é um erro simulado da interface. Tente carregar os dados novamente.</p>
      <button onClick={onRetry} type="button">Tentar novamente</button>
    </div>
  );
}

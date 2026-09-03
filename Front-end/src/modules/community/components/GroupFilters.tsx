import { FunnelSimple, MagnifyingGlass, X } from "@phosphor-icons/react";

import { ALL_FILTERS } from "../filterGroups";
import type { GroupFilters as Filters } from "../types";
import styles from "./GroupDirectory.module.css";

type GroupFiltersProps = {
  cohorts: string[];
  disciplines: string[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  topics: string[];
};

export function GroupFilters({ cohorts, disciplines, filters, onChange, topics }: GroupFiltersProps) {
  const hasActiveFilters =
    filters.query.length > 0 ||
    filters.discipline !== ALL_FILTERS ||
    filters.cohort !== ALL_FILTERS ||
    filters.topic !== ALL_FILTERS;

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section aria-labelledby="group-filter-title" className={styles.filterPanel}>
      <div className={styles.filterHeading}>
        <div>
          <FunnelSimple aria-hidden size={19} />
          <h3 id="group-filter-title">Filtrar comunidades</h3>
        </div>
        {hasActiveFilters ? (
          <button
            className={styles.clearFilters}
            onClick={() =>
              onChange({ query: "", discipline: ALL_FILTERS, cohort: ALL_FILTERS, topic: ALL_FILTERS })
            }
            type="button"
          >
            <X aria-hidden size={15} /> Limpar filtros
          </button>
        ) : null}
      </div>

      <div className={styles.filterGrid}>
        <label className={styles.searchField}>
          <span>Buscar grupo</span>
          <div>
            <MagnifyingGlass aria-hidden size={18} />
            <input
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Nome, disciplina ou assunto"
              type="search"
              value={filters.query}
            />
          </div>
        </label>

        <label className={styles.selectField}>
          <span>Disciplina</span>
          <select
            onChange={(event) => updateFilter("discipline", event.target.value)}
            value={filters.discipline}
          >
            <option value={ALL_FILTERS}>Todas</option>
            {disciplines.map((discipline) => (
              <option key={discipline} value={discipline}>{discipline}</option>
            ))}
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Turma e período</span>
          <select onChange={(event) => updateFilter("cohort", event.target.value)} value={filters.cohort}>
            <option value={ALL_FILTERS}>Todos</option>
            {cohorts.map((cohort) => (
              <option key={cohort} value={cohort}>{cohort}</option>
            ))}
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Assunto</span>
          <select onChange={(event) => updateFilter("topic", event.target.value)} value={filters.topic}>
            <option value={ALL_FILTERS}>Todos</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

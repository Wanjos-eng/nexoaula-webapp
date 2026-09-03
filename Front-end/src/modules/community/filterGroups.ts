import type { GroupFilters, StudyGroup } from "./types";

export const ALL_FILTERS = "all";

export function groupCohort(group: StudyGroup) {
  return `${group.classGroup} · ${group.period}`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterGroups(groups: StudyGroup[], filters: GroupFilters) {
  const query = normalize(filters.query);

  return groups.filter((group) => {
    const searchableContent = normalize(
      [group.name, group.description, group.discipline, group.classGroup, group.period, ...group.topics].join(" "),
    );
    const matchesQuery = !query || searchableContent.includes(query);
    const matchesDiscipline =
      filters.discipline === ALL_FILTERS || group.discipline === filters.discipline;
    const matchesCohort = filters.cohort === ALL_FILTERS || groupCohort(group) === filters.cohort;
    const matchesTopic = filters.topic === ALL_FILTERS || group.topics.includes(filters.topic);

    return matchesQuery && matchesDiscipline && matchesCohort && matchesTopic;
  });
}

export function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

// Catálogo demonstrativo; IDs locais não representam registros da API.
export const academicCatalog = [
  {
    id: "mock-msd",
    name: "Modelagem e Simulação Discreta",
    classes: [
      { id: "mock-msd-c8", name: "C8", term: "2026.2" },
      { id: "mock-msd-c9", name: "C9", term: "2026.2" },
    ],
  },
  {
    id: "mock-es",
    name: "Engenharia de Software",
    classes: [{ id: "mock-es-c1", name: "C1", term: "2026.2" }],
  },
  { id: "mock-ed", name: "Estruturas de Dados", classes: [] },
] as const;

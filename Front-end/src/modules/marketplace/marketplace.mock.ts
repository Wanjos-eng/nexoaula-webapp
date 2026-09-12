/**
 * marketplace.mock.ts
 * Dados simulados para a jornada de Sessões de Tutoria.
 * Os campos price_cents, commission_cents e currency seguem o modelo do DBML.
 * Nenhum dado bancário, PIX ou cartão é usado.
 */
import type { TutorSession } from "./marketplace.types";

export const mockSessions: TutorSession[] = [
  {
    id: "session-001",
    tutor_user_id: "user-tutor-1",
    tutor_name: "Rafael Emanuel",
    subject_id: "subj-001",
    subject_name: "Cálculo II",
    title: "Revisão de Séries de Taylor e Fourier para P2",
    description:
      "Resolução comentada dos exercícios mais cobrados em provas de Cálculo II. Foco em séries de Taylor e Fourier com exemplos práticos.",
    modality: "online",
    location: null,
    external_url: "https://meet.example.com/calcii-revisao",
    starts_at: "2026-09-15T19:00:00-03:00",
    ends_at: "2026-09-15T20:30:00-03:00",
    capacity: 10,
    enrolled_count: 4,
    price_cents: 2500,
    currency: "BRL",
    status: "scheduled",
  },
  {
    id: "session-002",
    tutor_user_id: "user-tutor-2",
    tutor_name: "Augusto Hawdani",
    subject_id: "subj-002",
    subject_name: "Estruturas de Dados",
    title: "Implementação de Árvores AVL — passo a passo",
    description:
      "Sessão prática de implementação de árvores AVL em Python. Código ao vivo e exercícios guiados.",
    modality: "online",
    location: null,
    external_url: "https://meet.example.com/avl-tree",
    starts_at: "2026-09-16T18:00:00-03:00",
    ends_at: "2026-09-16T19:30:00-03:00",
    capacity: 8,
    enrolled_count: 8,
    price_cents: 1500,
    currency: "BRL",
    status: "scheduled",
  },
  {
    id: "session-003",
    tutor_user_id: "user-tutor-1",
    tutor_name: "Rafael Emanuel",
    subject_id: "subj-003",
    subject_name: "Banco de Dados",
    title: "Modelagem ER e Normalização — Aula 1",
    description:
      "Fundamentos de modelagem relacional: entidades, atributos, cardinalidades e as três formas normais.",
    modality: "in_person",
    location: "Sala 204 — Bloco de Computação",
    external_url: null,
    starts_at: "2026-09-17T14:00:00-03:00",
    ends_at: "2026-09-17T15:30:00-03:00",
    capacity: 15,
    enrolled_count: 3,
    price_cents: 2000,
    currency: "BRL",
    status: "scheduled",
  },
];

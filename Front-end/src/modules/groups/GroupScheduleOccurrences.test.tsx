import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupSchedule } from "./GroupSchedule";
import type { GroupLessonOccurrence, GroupTopic, TeachingPlan } from "./schedule";

const groupId = "group-test-1";
const lessonId = "lesson-test-1";
const topicId = "topic-test-1";

const mockTopic: GroupTopic = {
  id: topicId,
  groupId,
  subjectTopicId: null,
  customTitle: "Derivadas Parciais",
  createdAt: new Date().toISOString(),
};

const mockPlan: TeachingPlan = {
  id: "plan-1",
  groupId,
  version: 1,
  status: "published",
  publishedAt: new Date().toISOString(),
  lessons: [
    {
      id: lessonId,
      groupId,
      planId: "plan-1",
      title: "Aula 01 - Cálculo Avançado",
      description: "Conceitos fundamentais",
      scheduledAt: "2026-09-08T14:00:00Z",
      topicIds: [topicId],
      createdAt: new Date().toISOString(),
    },
  ],
};

const mockOccurrence: GroupLessonOccurrence = {
  id: "occ-1",
  groupId,
  scheduledLessonId: lessonId,
  supersedesOccurrenceId: null,
  status: "held",
  actualStartedAt: "2026-09-08T14:00:00Z",
  actualEndedAt: "2026-09-08T16:00:00Z",
  rescheduledTo: null,
  notes: "Aula realizada em sala",
  recordedBy: "user-owner",
  createdAt: new Date().toISOString(),
  topicIds: [topicId],
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function setupServer(options?: {
  canManage?: boolean;
  occurrences?: GroupLessonOccurrence[];
  attendance?: any[];
  progress?: any[];
  adjustments?: any[];
}) {
  const occs = options?.occurrences ?? [mockOccurrence];
  const atts = options?.attendance ?? [];
  const progs = options?.progress ?? [];
  const adjs = options?.adjustments ?? [];

  return vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      const path = url.toString();
      const method = init?.method || "GET";

      if (path.includes("/plans?")) return json([mockPlan]);
      if (path.includes("/topics")) return json([mockTopic]);
      if (path.includes("/occurrences")) {
        if (method === "POST") {
          return json(mockOccurrence, 201);
        }
        return json(occs);
      }
      if (path.includes("/attendance-adjustments")) {
        if (method === "PATCH") {
          return json({ ...adjs[0], noticeSeenAt: new Date().toISOString() });
        }
        return json(adjs);
      }
      if (path.includes("/attendance")) {
        if (method === "POST") {
          const body = JSON.parse(String(init.body));
          return json({ lessonOccurrenceId: body.lessonOccurrenceId, groupId, status: body.status, updatedAt: new Date().toISOString() }, 201);
        }
        if (method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        return json(atts);
      }
      if (path.includes("/progress")) {
        if (method === "PUT") {
          const body = JSON.parse(String(init.body));
          return json({ groupTopicId: topicId, groupId, status: body.status, updatedAt: new Date().toISOString() });
        }
        return json(progs);
      }
      return json({});
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GroupSchedule - Occurrences and Attendance UI", () => {
  it("renderiza status Realizada e permite ao aluno registrar presença privada e progresso", async () => {
    setupServer({ canManage: false });

    render(<GroupSchedule groupId={groupId} canManage={false} />);

    // Lesson title and occurrence badge
    await screen.findByRole("heading", { name: "Aula 01 - Cálculo Avançado" });
    expect(screen.getByText("Realizada")).toBeDefined();
    expect(screen.getByText(/Registro Pessoal e Não Oficial/)).toBeDefined();

    // Student clicks "Presença"
    const presencaBtn = screen.getByRole("button", { name: "Presença" });
    fireEvent.click(presencaBtn);

    await screen.findByText(/Frequência privada salva/);

    // Topic progress: Student clicks "Dominado"
    const dominadoBtn = screen.getByRole("button", { name: "Dominado" });
    fireEvent.click(dominadoBtn);

    await screen.findByText(/Progresso do tópico atualizado/);
  });

  it("exibe aviso de retificação e permite marcar como visto", async () => {
    setupServer({
      adjustments: [
        {
          id: "adj-1",
          userId: "student-1",
          sourceOccurrenceId: "occ-old",
          targetOccurrenceId: "occ-1",
          targetStatus: "held",
          outcome: "transferred",
          previousStatus: "present",
          createdAt: new Date().toISOString(),
          noticeSeenAt: null,
        },
      ],
    });

    render(<GroupSchedule groupId={groupId} canManage={false} />);

    await screen.findByText(/Uma aula deste grupo foi retificada pelo organizador/);
    expect(screen.getByText(/transferida/)).toBeDefined();

    const dismissBtn = screen.getByRole("button", { name: "Entendi / Marcar como visto" });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Uma aula deste grupo foi retificada pelo organizador/)).toBeNull();
    });
  });

  it("organizador tem controle para retificar ocorrência", async () => {
    setupServer({ canManage: true });

    render(<GroupSchedule groupId={groupId} canManage={true} />);

    await screen.findByRole("heading", { name: "Aula 01 - Cálculo Avançado" });
    const retificarBtn = screen.getByRole("button", { name: "Retificar ocorrência" });
    fireEvent.click(retificarBtn);

    await screen.findByRole("heading", { name: /Retificar ocorrência/ });
    expect(screen.getByText("Status da ocorrência")).toBeDefined();

    // Organizer can cancel the occurrence form
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /Retificar ocorrência/ })).toBeNull();
    });
  });
});

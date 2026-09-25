import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GroupSchedule } from "./GroupSchedule";
import type { TeachingPlan } from "./schedule";

const groupId = "group-planner";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("mantém o fluxo real de criar, salvar, reabrir e publicar no planner profissional", async () => {
  let plans: TeachingPlan[] = [];
  const writes: Array<{ method: string; url: string; body: unknown }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, options: RequestInit = {}) => {
      const url = String(input);
      const method = options.method ?? "GET";

      if (
        method === "GET" &&
        (
          url.includes("/meetings") ||
          url.includes("/planning-corrections") ||
          url.includes("/topics") ||
          url.includes("/occurrences") ||
          url.includes("/attendance-adjustments") ||
          url.includes("/attendance") ||
          url.includes("/progress")
        )
      ) {
        return Promise.resolve(json([]));
      }

      if (method === "GET" && url.includes("/plans?")) {
        return Promise.resolve(json(plans));
      }

      if (url.endsWith(`/groups/${groupId}/plans`) && method === "POST") {
        const body = JSON.parse(String(options.body));
        writes.push({ method, url, body });
        const saved: TeachingPlan = {
          id: "plan-1",
          groupId,
          version: 1,
          status: "draft",
          publishedAt: null,
          lessons: body.lessons.map(
            (
              lesson: {
                title: string;
                description: string | null;
                scheduledAt: string;
                topicIds: string[];
              },
              index: number,
            ) => ({
              id: `lesson-${index + 1}`,
              groupId,
              planId: "plan-1",
              title: lesson.title,
              description: lesson.description,
              scheduledAt: lesson.scheduledAt,
              topicIds: lesson.topicIds,
              createdAt: "2026-09-25T18:00:00Z",
            }),
          ),
        };
        plans = [saved];
        return Promise.resolve(json(saved, 201));
      }

      if (url.endsWith(`/groups/${groupId}/plans/plan-1`) && method === "PATCH") {
        const body = JSON.parse(String(options.body));
        writes.push({ method, url, body });
        const current = plans[0];
        const saved: TeachingPlan = {
          ...current,
          lessons: body.lessons.map(
            (
              lesson: {
                title: string;
                description: string | null;
                scheduledAt: string;
                topicIds: string[];
              },
              index: number,
            ) => ({
              ...current.lessons[index],
              title: lesson.title,
              description: lesson.description,
              scheduledAt: lesson.scheduledAt,
              topicIds: lesson.topicIds,
            }),
          ),
        };
        plans = [saved];
        return Promise.resolve(json(saved));
      }

      if (
        url.endsWith(`/groups/${groupId}/plans/plan-1/publish`) &&
        method === "POST"
      ) {
        writes.push({
          method,
          url,
          body: JSON.parse(String(options.body)),
        });
        plans = [
          {
            ...plans[0],
            status: "published",
            publishedAt: "2026-09-25T19:00:00Z",
          },
        ];
        return Promise.resolve(json(plans[0]));
      }

      throw new Error(`Request inesperada no teste do planner: ${method} ${url}`);
    }),
  );

  const view = render(<GroupSchedule groupId={groupId} canManage />);

  expect(await screen.findByText("Planejamento acadêmico")).toBeTruthy();
  expect(screen.getByText("Estruture a ementa")).toBeTruthy();
  expect(screen.getByText("Monte as aulas")).toBeTruthy();
  expect(screen.getByText("Publique para o grupo")).toBeTruthy();
  expect(screen.getByText("Nenhum cronograma publicado ainda")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));

  expect(await screen.findByRole("heading", { name: "Montar cronograma" })).toBeTruthy();
  expect(screen.getByText("Seu cronograma ainda está vazio")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Adicionar aula/ }));
  fireEvent.change(screen.getByLabelText("Título da aula 1"), {
    target: { value: "Introdução a derivadas" },
  });
  fireEvent.change(screen.getByLabelText("Data e horário da aula 1"), {
    target: { value: "2026-10-15T18:30" },
  });
  fireEvent.change(screen.getByLabelText("Descrição da aula 1"), {
    target: { value: "Conceitos fundamentais e exercícios." },
  });

  expect(screen.getByText("01")).toBeTruthy();
  expect(screen.getByText("1 aula no rascunho")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

  await screen.findByText("Rascunho salvo.");
  await screen.findByRole("button", { name: "Editar rascunho" });

  fireEvent.click(screen.getByRole("button", { name: "Editar rascunho" }));
  expect(
    (screen.getByLabelText("Título da aula 1") as HTMLInputElement).value,
  ).toBe("Introdução a derivadas");

  fireEvent.change(screen.getByLabelText("Título da aula 1"), {
    target: { value: "Introdução a derivadas — revisão" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Publicar cronograma" }));

  await screen.findByText(
    "Cronograma publicado. Os membros já podem consultar as aulas.",
  );
  await screen.findByRole("heading", {
    name: "Introdução a derivadas — revisão",
  });
  expect(screen.getByText("Visível para o grupo")).toBeTruthy();

  await waitFor(() => {
    expect(writes.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `POST /api/v1/groups/${groupId}/plans`,
      `PATCH /api/v1/groups/${groupId}/plans/plan-1`,
      `POST /api/v1/groups/${groupId}/plans/plan-1/publish`,
    ]);
  });

  expect(writes[2].body).toEqual({});
  view.unmount();
});

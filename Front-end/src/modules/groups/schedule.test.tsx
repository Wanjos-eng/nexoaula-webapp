vi.mock("@/modules/auth", () => ({ useAuthSession: () => ({ user: { id: "owner" } }) }));
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupDetail } from "./GroupDetail";
import { GroupSchedule } from "./GroupSchedule";
import { AcademicCalendarView } from "@/modules/academic/components/AcademicCalendarView";
import { AcademicGroups } from "@/modules/academic/components/AcademicGroups";
import { readAll, type TeachingPlan } from "./schedule";

const group = {
  id: "group-one", name: "Grupo A", disciplineId: "subject", offeringId: "section",
  status: "active", joinPolicy: "open", visibility: "public", ownerId: "owner", capacity: null,
};
const lesson = { id: "lesson-one", groupId: group.id, planId: "plan-one", title: "Aula real",
  description: "Objetivos da aula", scheduledAt: new Date().toISOString(), topicIds: ["topic-existing"], createdAt: new Date().toISOString() };
const plan: TeachingPlan = { id: "plan-one", groupId: group.id, version: 1, status: "published",
  publishedAt: new Date().toISOString(), lessons: [lesson] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function server(handler: (url: string, options: RequestInit) => Response | Promise<Response>) {
  return vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => (url.includes("/meetings") || url.includes("marketplace/bookings/mine") || url.includes("/topics")) ? json([]) : handler(url, options)));
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("cronograma no detalhe real", () => {
  it("cria, salva, reabre, edita e publica pelo contrato real; membro vê só a versão publicada", async () => {
    let plans: TeachingPlan[] = [];
    let role = "owner";
    const writes: string[] = [];
    server((url, options) => {
      if (options.method !== "GET") {
        expect(new Headers(options.headers).get("Content-Type")).toBe("application/json");
        expect(new Headers(options.headers).get("X-NexoAula-CSRF")).toBe("1");
        writes.push(`${options.method} ${url}`);
        const body = JSON.parse(String(options.body));
        if (url.endsWith("/publish")) {
          expect(body).toEqual({});
          plans[0] = { ...plans[0], status: "published" };
        } else {
          expect(body).toHaveProperty("lessons");
          expect(body.lessons[0].scheduledAt).toMatch(/Z$/);
          plans = [{ ...plan, status: "draft", lessons: body.lessons.map((item: object) => ({ ...lesson, ...item })) }];
        }
        return json(plans[0], 200);
      }
      if (url.includes("/plans?")) return json(plans);
      if (url.includes("/members?")) return json([]);
      if (url.endsWith("/participation")) return json({ status: "active", role, canManage: role === "owner", memberCount: 2 });
      return json(group);
    });
    let view = render(<GroupDetail groupId={group.id} />);
    fireEvent.click(await screen.findByText("Criar rascunho"));
    fireEvent.click(screen.getByText("Adicionar aula"));
    fireEvent.change(screen.getByLabelText("Título da aula 1"), { target: { value: "Introdução" } });
    fireEvent.change(screen.getByLabelText("Data e horário da aula 1"), { target: { value: "2026-10-15T18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByText("Rascunho salvo.");
    view.unmount();
    view = render(<GroupDetail groupId={group.id} />);
    fireEvent.click(await screen.findByText("Editar rascunho"));
    expect((screen.getByLabelText("Título da aula 1") as HTMLInputElement).value).toBe("Introdução");
    fireEvent.change(screen.getByLabelText("Título da aula 1"), { target: { value: "Introdução revisada" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar cronograma" }));
    await screen.findByText("Cronograma publicado. Os membros já podem consultar as aulas.");
    expect(writes).toEqual([
      "/api/v1/groups/group-one/plans",
      "/api/v1/groups/group-one/plans/plan-one",
      "/api/v1/groups/group-one/plans/plan-one/publish",
    ].map((path, i) => `${i === 1 ? "PATCH" : "POST"} ${path}`));
    view.unmount();
    role = "member";
    plans.push({ ...plan, id: "private-draft", status: "draft", version: 2,
      lessons: [{ ...lesson, title: "Rascunho não publicado" }] });
    render(<GroupDetail groupId={group.id} />);
    await screen.findByRole("heading", { name: "Introdução revisada" });
    expect(screen.queryByText("Rascunho não publicado")).toBeNull();
    expect(screen.queryByText("Editar rascunho")).toBeNull();
    expect(screen.queryByText("Criar nova versão")).toBeNull();
  });

  it("preserva tópicos na nova versão e retenta publicação com o ID salvo após falha", async () => {
    let plans = [plan];
    let publishes = 0, creates = 0;
    server((url, options) => {
      if (options.method === "GET") return json(plans);
      if (url.endsWith("/publish")) {
        publishes++;
        if (publishes === 1) return json({ detail: "Falha temporária" }, 503);
        plans = [{ ...plans[0], status: "published" }, { ...plan, status: "archived" }];
        return json(plans[0]);
      }
      const body = JSON.parse(String(options.body));
      expect(body.lessons[0].topicIds).toEqual(["topic-existing"]);
      if (options.method === "POST") creates++;
      plans = [{ ...plan, id: "plan-two", version: 2, status: "draft" }, plan];
      return json(plans[0]);
    });
    render(<GroupSchedule groupId={group.id} canManage />);
    fireEvent.click(await screen.findByText("Criar nova versão"));
    fireEvent.click(screen.getByRole("button", { name: "Publicar cronograma" }));
    await screen.findByText("Falha temporária");
    fireEvent.click(screen.getByRole("button", { name: "Publicar cronograma" }));
    await screen.findByText("Cronograma publicado. Os membros já podem consultar as aulas.");
    expect(creates).toBe(1);
    expect(publishes).toBe(2);
  });

  it("não envia aula sem título/data e exibe falha de leitura com nova tentativa", async () => {
    let fail = true;
    const mutations = vi.fn();
    server((_, options) => {
      if (options.method !== "GET") mutations();
      return fail ? json({ detail: "Sem acesso ao cronograma" }, 403) : json([]);
    });
    render(<GroupSchedule groupId={group.id} canManage />);
    await screen.findByText("Sem acesso ao cronograma");
    expect(screen.queryByText("Criar rascunho")).toBeNull();
    fail = false;
    fireEvent.click(screen.getByText("Tentar novamente"));
    fireEvent.click(await screen.findByText("Criar rascunho"));
    fireEvent.click(screen.getByText("Adicionar aula"));
    fireEvent.submit(screen.getByRole("form", { name: "Editar cronograma" }));
    await screen.findByText("Informe título e data/hora válidos para cada aula.");
    expect(mutations).not.toHaveBeenCalled();
  });
});

describe("calendário e contexto acadêmico reais", () => {
  function calendarServer() {
    let removed = false, failure = false;
    const urls: string[] = [];
    server((url) => {
      urls.push(url);
      if (failure) return json({ detail: "Serviço indisponível" }, 503);
      if (url.includes("groups/mine?")) return json(removed ? [] : [group, { ...group, id: "group-two", name: "Grupo B" }]);
      if (url.includes("academic/subjects?")) return json([{ id: "subject", name: "Cálculo" }]);
      if (url.includes("academic/class-sections?")) return json([{ id: "section", label: "Turma A", academicTermId: "term" }]);
      if (url.includes("academic/academic-terms?")) return json([{ id: "term", label: "2026.2" }]);
      if (url.includes("groups/me/lessons?")) return json([lesson, { ...lesson, id: "lesson-two", groupId: "group-two" }]);
      throw new Error(url);
    });
    return { urls, remove: () => { removed = true; }, fail: () => { failure = true; } };
  }
  it("mostra duas aulas iguais com origens distintas, navega e revalida após remoção", async () => {
    const api = calendarServer();
    render(<AcademicCalendarView />);
    await screen.findByRole("navigation", { name: "Grupos no calendário" });
    const details = screen.getAllByRole("link", { name: "Detalhar aula no grupo" });
    expect(details.map((link) => link.getAttribute("href"))).toEqual([
      "/grupos/group-one#aula-lesson-one", "/grupos/group-two#aula-lesson-two",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await waitFor(() => expect(api.urls.filter((url) => url.includes("/me/lessons?"))).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: /Hoje/ }));
    await waitFor(() => expect(api.urls.filter((url) => url.includes("/me/lessons?"))).toHaveLength(3));
    api.remove();
    act(() => { window.dispatchEvent(new Event("focus")); });
    await screen.findByText("Você ainda não participa de grupos");
    expect(screen.queryByText("Aula real")).toBeNull();
    expect(screen.getByRole("link", { name: "Descobrir grupos" }).getAttribute("href")).toBe("/grupos?view=discover");
  });
  it("mantém grupos da mesma turma separados e usa seus IDs na listagem acadêmica", async () => {
    calendarServer();
    render(<AcademicGroups />);
    const list = await screen.findByRole("region", { name: "Disciplinas por grupo" });
    expect(within(list).getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Abrir cronograma de Grupo B" }).getAttribute("href")).toBe("/grupos/group-two#cronograma");
    fireEvent.change(screen.getByLabelText("Buscar disciplina ou grupo"), { target: { value: "Grupo B" } });
    expect(within(list).getAllByRole("article")).toHaveLength(1);
  });
  it("mostra erro sem manter aulas antigas após uma falha de atualização", async () => {
    const api = calendarServer();
    render(<AcademicCalendarView />);
    await screen.findByRole("navigation", { name: "Grupos no calendário" });
    api.fail();
    fireEvent.click(screen.getByText("Atualizar calendário"));
    await screen.findByText("Serviço indisponível");
    expect(screen.queryByText("Aula real")).toBeNull();
  });
  it("percorre a paginação até incluir registros além do primeiro lote", async () => {
    const urls: string[] = [];
    server((url) => { urls.push(url); return json(url.includes("offset=0") ? Array.from({ length: 100 }, (_, id) => id) : [100]); });
    const result = await readAll<number>("groups/me/lessons?period=future");
    expect(result).toHaveLength(101);
    expect(urls[1]).toContain("period=future&limit=100&offset=100");
  });
});

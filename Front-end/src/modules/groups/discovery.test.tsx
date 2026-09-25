import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GroupDirectory } from "./GroupDirectory";
import { GroupForm } from "./GroupForm";
import type { Group } from "./api";

const group: Group = { id: "g", name: "Grupo real", description: null, rules: null, visibility: "public", joinPolicy: "open", disciplineId: "s", offeringId: "c", ownerId: "o", status: "active", capacity: null };
const catalogs: Record<string, unknown[]> = {
  subjects: [{ id: "s", name: "Cálculo" }, { id: "s2", name: "Física" }],
  "academic-terms": [{ id: "term", label: "2026.2" }],
  "class-sections": [{ id: "c", subjectId: "s", academicTermId: "term", label: "Turma A" }],
  teachers: [{ id: "teacher", fullName: "Professora Ada" }],
  "class-section-teachers": [{ id: "a", classSectionId: "c", teacherId: "teacher" }],
  topics: [{ id: "t", name: "Integrais" }],
  "subject-topics": [{ id: "st", subjectId: "s", topicId: "t" }],
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

it("envia IDs reais, limpa combinações dependentes e mantém o vazio real", async () => {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.includes("academic/")) return Promise.resolve(response(catalogs[url.split("academic/")[1].split("?")[0]]));
    urls.push(url);
    return Promise.resolve(response([]));
  }));
  render(<GroupDirectory initialView="discover" />);
  await screen.findByRole("option", { name: "Professora Ada" });
  fireEvent.change(screen.getByLabelText("Disciplina do catálogo"), { target: { value: "s" } });
  fireEvent.change(screen.getByLabelText("Turma"), { target: { value: "c" } });
  fireEvent.change(screen.getByLabelText("Professor"), { target: { value: "teacher" } });
  fireEvent.change(screen.getByLabelText("Assunto da disciplina"), { target: { value: "st" } });
  fireEvent.submit(screen.getByRole("search"));
  await waitFor(() => expect(urls.at(-1)).toContain("subjectTopicId=st"));
  expect(urls.at(-1)).toContain("teacherId=teacher");
  expect(urls.at(-1)).toContain("classSectionId=c");
  await screen.findByText("Nenhum grupo encontrado");
  fireEvent.change(screen.getByLabelText("Disciplina do catálogo"), { target: { value: "s2" } });
  for (const label of ["Professor", "Turma", "Assunto da disciplina"]) expect((screen.getByLabelText(label) as HTMLSelectElement).value).toBe("");
  expect(screen.queryByRole("option", { name: "Professora Ada" })).toBeNull();
  fireEvent.submit(screen.getByRole("search"));
  await waitFor(() => expect(urls.at(-1)).toContain("subjectId=s2"));
  expect(urls.at(-1)).not.toContain("teacherId");
});

it("restaura assuntos, preserva seleção após erro e salva a configuração", async () => {
  let ids = ["st"];
  let fail = true;
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.includes("academic/")) return Promise.resolve(response(catalogs[url.split("academic/")[1].split("?")[0]]));
    if (url.endsWith("/topics")) return Promise.resolve(response(ids.map((id) => ({ subjectTopicId: id }))));
    if (options.method === "PATCH") {
      if (fail) return Promise.resolve(response({ detail: "Assunto usado em uma aula." }, 409));
      ids = JSON.parse(String(options.body)).subjectTopicIds;
      return Promise.resolve(response(group));
    }
    return Promise.resolve(response(group));
  }));
  const saved = vi.fn();
  const view = render(<GroupForm group={group} onSaved={saved} />);
  const checkbox = await screen.findByRole("checkbox", { name: "Integrais" });
  expect((checkbox as HTMLInputElement).checked).toBe(true);
  fireEvent.click(checkbox);
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Assunto usado em uma aula.");
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  fail = false;
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  view.unmount();
  render(<GroupForm group={group} />);
  expect(((await screen.findByRole("checkbox", { name: "Integrais" })) as HTMLInputElement).checked).toBe(false);
});

it("apresenta falha do catálogo sem inventar opções e permite recuperar", async () => {
  let fail = true;
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("academic/")
    ? fail ? response({ detail: "Catálogo temporariamente indisponível." }, 503) : response([])
    : response([]))));
  render(<GroupDirectory initialView="discover" />);
  await screen.findByText("Catálogo temporariamente indisponível.");
  expect(screen.queryByLabelText("Professor")).toBeNull();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
  await screen.findByText("Nenhum professor vinculado neste contexto");
});

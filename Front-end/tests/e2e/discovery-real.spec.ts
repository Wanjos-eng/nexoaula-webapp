import { expect, test, type Page } from "@playwright/test";

const headers = { "X-NexoAula-CSRF": "1", Origin: "http://localhost:3000" };
async function post(page: Page, path: string, data: unknown) {
  const result = await page.request.post(`/api/v1/${path}`, { data, headers });
  expect(result.ok(), `${path}: ${await result.text()}`).toBe(true);
  return result.json();
}
async function authenticate(page: Page, suffix: string) {
  const credentials = { email: `discovery-${suffix}@example.com`, password: "discovery-test-password" };
  await post(page, "auth/register", { ...credentials, fullName: "Estudante Descoberta" });
  await post(page, "auth/login", credentials);
}

test("descoberta acadêmica persiste assuntos e respeita visibilidade entre usuários", async ({ browser }) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerContext = await browser.newContext();
  const readerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const reader = await readerContext.newPage();
  try {
    await authenticate(owner, `owner-${suffix}`);
    const institution = await post(owner, "academic/institutions", { name: `Universidade ${suffix}` });
    const subject = await post(owner, "academic/subjects", { institutionId: institution.id, name: `Cálculo ${suffix}` });
    const term = await post(owner, "academic/academic-terms", { institutionId: institution.id, label: "2026.2", startDate: "2026-08-01", endDate: "2026-12-31" });
    const section = await post(owner, "academic/class-sections", { subjectId: subject.id, academicTermId: term.id, label: "Turma A" });
    const teacher = await post(owner, "academic/teachers", { institutionId: institution.id, fullName: `Professora ${suffix}` });
    await post(owner, "academic/class-section-teachers", { teacherId: teacher.id, classSectionId: section.id, startsOn: "2026-08-01" });
    const topic = await post(owner, "academic/topics", { slug: `integrais-${suffix}`, name: `Integrais ${suffix}` });
    const subjectTopic = await post(owner, "academic/subject-topics", { subjectId: subject.id, topicId: topic.id });
    await owner.goto("/grupos/novo");
    const groupName = `Estudo ${suffix}`;
    await owner.getByLabel("Nome da comunidade *").fill(groupName);
    await owner.getByLabel("Disciplina *", { exact: true }).selectOption(subject.id);
    await owner.getByLabel("Turma (opcional)").selectOption(section.id);
    await owner.getByRole("checkbox", { name: topic.name }).check();
    await owner.getByRole("button", { name: "Criar comunidade", exact: true }).click();
    await owner.getByRole("link", { name: "Acessar comunidade" }).click();
    await owner.waitForURL(/\/grupos\/[0-9a-f-]{36}$/);
    const groupId = new URL(owner.url()).pathname.split("/").pop()!;
    await owner.getByRole("button", { name: "Configurar", exact: true }).click();
    await expect(owner.getByRole("checkbox", { name: topic.name })).toBeChecked();
    await owner.getByRole("checkbox", { name: topic.name }).uncheck();
    await owner.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(owner.getByText("Configurações salvas.")).toBeVisible();
    await owner.reload();
    await owner.getByRole("button", { name: "Configurar", exact: true }).click();
    await expect(owner.getByRole("checkbox", { name: topic.name })).not.toBeChecked();
    await owner.getByRole("checkbox", { name: topic.name }).check();
    await owner.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(owner.getByText("Configurações salvas.")).toBeVisible();
    const hidden = await post(owner, "groups", { name: `Privado ${suffix}`, disciplineId: subject.id, offeringId: section.id, subjectTopicIds: [subjectTopic.id], visibility: "private" });
    await authenticate(reader, `reader-${suffix}`);
    await reader.goto("/grupos?view=discover");
    await reader.getByLabel("Disciplina do catálogo").selectOption(subject.id);
    await reader.getByLabel("Turma", { exact: true }).selectOption(section.id);
    await reader.getByLabel("Professor", { exact: true }).selectOption(teacher.id);
    await reader.getByLabel("Assunto da disciplina").selectOption(subjectTopic.id);
    await reader.getByRole("button", { name: "Buscar comunidades", exact: true }).click();
    await expect(reader.getByRole("link", { name: groupName, exact: true })).toBeVisible();
    await expect(reader.getByRole("link", { name: hidden.name, exact: true })).toHaveCount(0);
    expect((await reader.request.patch(`/api/v1/groups/${groupId}`, { data: { subjectTopicIds: [] }, headers })).status()).toBe(403);
    await reader.getByLabel("Assunto ou nome").fill(`inexistente-${suffix}`);
    await reader.getByRole("button", { name: "Buscar comunidades", exact: true }).click();
    await expect(reader.getByRole("heading", { name: "Nenhuma comunidade encontrada" })).toBeVisible();
    await reader.getByLabel("Assunto ou nome").fill("");
    await reader.route("**/api/v1/groups?**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Falha temporária de teste." }) }), { times: 1 });
    await reader.getByRole("button", { name: "Buscar comunidades", exact: true }).click();
    await expect(reader.getByText("Falha temporária de teste.")).toBeVisible();
    await reader.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(reader.getByRole("link", { name: groupName, exact: true })).toBeVisible();
  } finally {
    await ownerContext.close();
    await readerContext.close();
  }
});

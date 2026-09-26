import { expect, test, type Page } from "@playwright/test";

const groupId = "11111111-1111-4111-8111-111111111111";
const group = { id: groupId, name: "Cálculo em companhia", disciplineId: "subject", offeringId: "section", subjectName: "Cálculo diferencial", period: "2026.2", visibility: "public", joinPolicy: "open", ownerId: "ana", status: "active", description: "Estudar juntos, evoluir no próprio ritmo.", rules: null, capacity: null };
const lesson = { id: "lesson", groupId, planId: "plan", title: "Limites e continuidade", description: "Conceitos fundamentais e exercícios.", scheduledAt: "2026-09-01T14:00:00Z", topicIds: ["topic"] };
const occurrence = { id: "occ", groupId, scheduledLessonId: "lesson", status: "held", actualStartedAt: "2026-09-01T14:00:00Z", actualEndedAt: "2026-09-01T16:00:00Z", topicIds: ["topic"], notes: null };

async function fixture(page: Page, options = { attendanceFailure: false }) {
  let attendance: object[] = [];
  const calls: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1/", "");
    calls.push(`${req.method()} ${path}`);
    let body: unknown = [];
    if (path.startsWith("auth/")) body = { id: "ana", fullName: "Ana Silva", email: "ana@example.com", createdAt: "2026-01-01T00:00:00Z" };
    else if (path === "groups/mine") body = [group];
    else if (path === `groups/${groupId}`) body = group;
    else if (path.endsWith("/participation")) body = { status: "active", role: "owner", canManage: true, memberCount: 3 };
    else if (path.endsWith("/plans")) body = [{ id: "plan", groupId, version: 1, status: "published", publishedAt: "2026-09-01T10:00:00Z", lessons: [lesson] }];
    else if (path.endsWith("/topics")) body = [{ id: "topic", groupId, customTitle: null, topicName: "Limites", subjectTopicId: "subject-topic" }];
    else if (path.endsWith("/occurrences")) body = [occurrence];
    else if (path === "me/attendance") {
      if (options.attendanceFailure) return route.fulfill({ status: 503, json: { detail: "Não foi possível carregar a frequência." } });
      if (req.method() === "POST") {
        const record = { ...req.postDataJSON(), groupId, updatedAt: new Date().toISOString() };
        attendance = [record]; body = record;
      } else body = attendance;
    } else if (path === "academic/subjects") body = [{ id: "subject", name: "Cálculo diferencial" }];
    else if (path === "academic/class-sections") body = [{ id: "section", label: "Turma A", academicTermId: "term" }];
    else if (path === "academic/academic-terms") body = [{ id: "term", label: "2026.2" }];
    else if (path === "academic/profile") body = { userId: "ana", displayName: "Ana Silva" };
    await route.fulfill({ json: body });
  });
  return calls;
}

for (const width of [1440, 390]) {
  test(`disciplina pessoal, frequência, chat e foco em ${width}px`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 960 });
    await fixture(page);
    await page.goto("/disciplinas");
    await expect(page.getByRole("heading", { name: "Cálculo diferencial" })).toBeVisible();
    await expect(page.getByText("Aguardando publicação do organizador")).toBeVisible();
    await page.screenshot({ path: info.outputPath("disciplinas.png"), fullPage: true });
    await page.getByRole("link", { name: "Abrir disciplina", exact: true }).click();
    await expect(page).toHaveURL(/\/disciplinas\/section\?group=/);
    await expect(page.getByRole("heading", { name: "Ementa e tópicos de estudo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar rascunho" })).toHaveCount(0);
    await page.getByRole("button", { name: "Falta", exact: true }).click();
    await expect(page.getByRole("button", { name: "✗ Falta" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "✗ Falta" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("disciplina-pessoal.png"), fullPage: true });
    await page.goto(`/grupos/${groupId}`);
    await page.getByRole("button", { name: "Sugerir correção", exact: true }).first().click();
    const field = page.getByRole("dialog").getByRole("textbox").last();
    await field.pressSequentially("Revisar o horário da aula", { delay: 30 });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("Revisar o horário da aula");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/frequencia");
    await expect(page.getByRole("heading", { name: "Minha Frequência", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "✗ Falta" })).toBeVisible();
    await page.goto("/chat");
    await expect(page.getByText("Em breve", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("chat.png"), fullPage: true });
  });
}

test("cadastro inicia login automaticamente sem mensagem ou atraso de sucesso", async ({ page }) => {
  const calls = await fixture(page);
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill("Ana Silva");
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura");
  await page.getByLabel("Confirmar senha").fill("senha-segura");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  expect(calls.indexOf("POST auth/login")).toBeGreaterThan(calls.indexOf("POST auth/register"));
  await expect(page.getByText(/Conta criada com sucesso|Acesso confirmado/)).toHaveCount(0);
});

test("falha da frequência é visível e não permite sobrescrever registros desconhecidos", async ({ page }) => {
  await fixture(page, { attendanceFailure: true });
  await page.goto("/frequencia");
  await expect(page.getByText("Não foi possível carregar a frequência.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Falta", exact: true })).toHaveCount(0);
});

test("organizador publica aulas e horários; membro consulta pela disciplina pessoal", async ({ page }) => {
  await fixture(page);
  let published = false;
  let lessons = [lesson];
  const writes: string[] = [];
  await page.route(`**/api/v1/groups/${groupId}/plans**`, async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      writes.push(request.url());
      if (request.url().endsWith("/publish")) published = true;
      else lessons = request.postDataJSON().lessons.map((item: object) => ({ ...lesson, ...item }));
    }
    const plan = { id: "new-plan", groupId, version: 2, status: published ? "published" : "draft", lessons };
    await route.fulfill({ json: request.method() === "GET" ? [plan] : plan });
  });
  await page.goto(`/grupos/${groupId}`);
  await page.getByRole("button", { name: "Editar rascunho" }).click();
  await page.getByLabel("Título da aula 1").fill("Integrais e aplicações");
  await page.getByLabel("Data e horário da aula 1").fill("2026-10-01T10:00");
  await page.getByRole("button", { name: "Publicar cronograma" }).click();
  await expect.poll(() => published).toBe(true);
  expect(writes).toHaveLength(2);
  await page.goto(`/disciplinas/section?group=${groupId}`);
  await expect(page.getByRole("heading", { name: "Integrais e aplicações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar cronograma" })).toHaveCount(0);
});

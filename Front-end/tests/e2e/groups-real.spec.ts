import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const password = "senha-e2e-segura";
const csrfHeaders = {
  "X-NexoAula-CSRF": "1",
  Origin: "http://localhost:3000",
};

type User = { email: string; fullName: string };

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueUser(role: string): User {
  const id = uniqueId();
  return { email: `e2e-groups-${role}-${id}@example.com`, fullName: `E2E ${role}` };
}

async function registerAndLogin(page: Page, user: User) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill(user.fullName);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("status")).toContainText("Conta criada com sucesso");
  await page.waitForURL(/\/login$/, { timeout: 5_000 });
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/inicio$/, { timeout: 5_000 });
}

async function postJson<T>(page: Page, path: string, body: unknown): Promise<T> {
  const response = await page.request.post(`/api/v1/${path}`, {
    data: body,
    headers: csrfHeaders,
  });
  expect(response.ok(), `${path} respondeu ${response.status()}`).toBe(true);
  return response.json() as Promise<T>;
}

async function prepareAcademicContext(page: Page) {
  const suffix = uniqueId();
  const institution = await postJson<{ id: string }>(page, "academic/institutions", {
    name: `Universidade E2E ${suffix}`,
    shortName: `E2E${suffix.slice(-4)}`,
  });
  const course = await postJson<{ id: string }>(page, "academic/courses", {
    institutionId: institution.id,
    name: `Engenharia E2E ${suffix}`,
    code: `E2E-${suffix.slice(-6)}`,
  });
  const subject = await postJson<{ id: string }>(page, "academic/subjects", {
    institutionId: institution.id,
    name: `Cálculo E2E ${suffix}`,
    code: `CALC-${suffix.slice(-6)}`,
  });
  const term = await postJson<{ id: string }>(page, "academic/academic-terms", {
    institutionId: institution.id,
    label: `2026.${suffix.slice(-2)}`,
    startDate: "2026-08-01",
    endDate: "2026-12-20",
  });
  const section = await postJson<{ id: string }>(page, "academic/class-sections", {
    subjectId: subject.id,
    academicTermId: term.id,
    label: `Turma E2E ${suffix.slice(-4)}`,
  });

  await page.goto("/perfil");
  await page.getByLabel("Instituição").selectOption(institution.id);
  await page.getByLabel("Curso").selectOption(course.id);
  await page.getByLabel(/Sobre mim/).fill("Contexto preparado para a jornada E2E.");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Perfil atualizado com sucesso.")).toBeVisible();

  return { subjectId: subject.id, sectionId: section.id };
}

async function logout(context: BrowserContext, page: Page) {
  await page.request.post("/api/v1/auth/logout", {
    data: {},
    headers: csrfHeaders,
  });
  await context.clearCookies();
}

test.describe("grupos ponta a ponta com API e PostgreSQL reais", () => {
  test("autentica, prepara contexto, cria, descobre, solicita e aprova participação", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();
    const ownerUser = uniqueUser("organizador");
    const memberUser = uniqueUser("participante");

    try {
      await registerAndLogin(owner, ownerUser);
      const academic = await prepareAcademicContext(owner);

      await owner.goto("/grupos/novo");
      await owner.getByLabel("Nome do grupo *").fill(`Grupo E2E ${uniqueId()}`);
      await owner.getByLabel("Disciplina *", { exact: true }).selectOption(academic.subjectId);
      await owner.getByLabel("Turma (opcional)").selectOption(academic.sectionId);
      await owner.getByLabel("Descrição").fill("Grupo criado pela jornada E2E real.");
      await owner.getByLabel("Combinados do grupo").fill("Respeitar o ritmo de estudo.");
      await owner.getByLabel("Entrada").selectOption("approval_required");
      await owner.getByRole("button", { name: "Criar grupo", exact: true }).click();
      await owner.getByRole("link", { name: "Acessar grupo" }).click();
      await expect(owner.getByRole("heading", { name: "Gerenciar participantes" })).toBeVisible();
      const groupUrl = owner.url();
      const groupId = new URL(groupUrl).pathname.split("/").pop();
      expect(groupId).toBeTruthy();
      const groupName = await owner.locator("h1").innerText();

      // Exercise the actual versioned plan contract through the production UI.
      await owner.getByRole("button", { name: "Criar rascunho" }).click();
      await owner.getByRole("button", { name: "Adicionar aula" }).click();
      await owner.getByLabel("Título da aula 1").fill("Aula inicial E2E");
      const today = await owner.evaluate(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T12:00`;
      });
      await owner.getByLabel("Data e horário da aula 1").fill(today);
      await owner.getByRole("button", { name: "Salvar rascunho" }).click();
      await expect(owner.getByText("Rascunho salvo.")).toBeVisible();
      await owner.reload();
      await owner.getByRole("button", { name: "Editar rascunho" }).click();
      await expect(owner.getByLabel("Título da aula 1")).toHaveValue("Aula inicial E2E");
      await owner.getByLabel("Título da aula 1").fill("Aula publicada E2E");
      await owner.getByRole("button", { name: "Publicar cronograma" }).click();
      await expect(owner.getByRole("heading", { name: "Aula publicada E2E" })).toBeVisible();

      await registerAndLogin(member, memberUser);
      await member.goto("/calendario");
      await expect(member.getByTestId("calendar-empty-state")).toBeVisible();
      await expect(member.getByRole("heading", { name: "Você ainda não participa de grupos" })).toBeVisible();
      await member.goto("/grupos?view=discover");
      await member.getByRole("search").getByLabel("Assunto ou nome").fill(groupName);
      await member.getByRole("button", { name: "Buscar grupos" }).click();
      await member.getByRole("link", { name: groupName }).click();
      await expect(member.getByRole("heading", { name: groupName })).toBeVisible();
      await member.getByRole("button", { name: "Solicitar entrada" }).click();
      await expect(member.getByText("Solicitação enviada.")).toBeVisible();
      await member.reload();
      await expect(member.getByText("Solicitação pendente", { exact: true })).toBeVisible();

      const duplicate = await member.request.post(
        new URL(`/api/v1/groups/${groupId}/join`, member.url()).toString(),
        { data: {}, headers: csrfHeaders },
      );
      expect(duplicate.status()).toBe(409);

      await owner.goto(groupUrl);
      await expect(owner.getByText(memberUser.fullName)).toBeVisible();
      await owner.getByRole("button", { name: "Aprovar", exact: true }).click();
      await expect(owner.getByText("Solicitação aprovada.")).toBeVisible();
      await expect(owner.getByText("Nenhuma solicitação pendente.")).toBeVisible();

      await member.reload();
      await expect(member.getByText("Você participa", { exact: true })).toBeVisible();
      await expect(member.getByRole("heading", { name: "Aula publicada E2E" })).toBeVisible();
      await expect(member.getByRole("button", { name: "Criar nova versão" })).toHaveCount(0);
      const denied = await member.request.post(`/api/v1/groups/${groupId}/plans`, {
        data: { lessons: [] }, headers: csrfHeaders,
      });
      expect(denied.status()).toBe(403);
      await member.goto("/calendario");
      await expect(member.getByRole("heading", { name: "Aula publicada E2E" })).toBeVisible();
      await member.getByRole("button", { name: "Próximo mês" }).click();
      await member.getByRole("button", { name: /^Hoje/ }).click();
      await member.getByRole("link", { name: "Detalhar aula no grupo" }).click();
      await expect(member).toHaveURL(new RegExp(`/grupos/${groupId}#aula-`));
      await expect(member.getByRole("heading", { name: "Aula publicada E2E" })).toBeVisible();
      await expect(member.getByRole("heading", { name: "Aula publicada E2E" })).toBeInViewport();
      await member.goto("/grupos");
      await expect(member.getByRole("link", { name: groupName })).toBeVisible();
      await member.reload();
      await expect(member.getByRole("link", { name: groupName })).toBeVisible();

      await owner.screenshot({ path: testInfo.outputPath("groups-owner-approved.png"), fullPage: true });
      await member.screenshot({ path: testInfo.outputPath("groups-member-persisted.png"), fullPage: true });

      // Same class section, separate group and lesson identity in the calendar.
      const second = await postJson<{ id: string }>(owner, "groups", {
        name: `Segundo grupo ${uniqueId()}`, disciplineId: academic.subjectId,
        offeringId: academic.sectionId, visibility: "public", joinPolicy: "open",
      });
      const plan = await postJson<{ id: string }>(owner, `groups/${second.id}/plans`, {
        lessons: [{ title: "Aula do segundo grupo", scheduledAt: await owner.evaluate((date) => new Date(date).toISOString(), today), topicIds: [] }],
      });
      await postJson(owner, `groups/${second.id}/plans/${plan.id}/publish`, {});
      await postJson(member, `groups/${second.id}/join`, {});
      await member.goto("/calendario");
      await expect(member.getByRole("link", { name: "Detalhar aula no grupo" })).toHaveCount(2);
      await member.goto("/disciplinas");
      await expect(member.locator(`a[href="/grupos/${groupId}#cronograma"]`)).toBeVisible();
      await expect(member.locator(`a[href="/grupos/${second.id}#cronograma"]`)).toBeVisible();
      const members = await owner.request.get(`/api/v1/groups/${groupId}/members?pending=false`);
      const participant = (await members.json() as { userId: string; displayName: string }[])
        .find((entry) => entry.displayName === memberUser.fullName)!;
      await member.goto("/calendario");
      for (const id of [groupId, second.id]) {
        const removed = await owner.request.patch(`/api/v1/groups/${id}/members/${participant.userId}`, {
          data: { action: "remove" }, headers: csrfHeaders,
        });
        expect(removed.ok()).toBe(true);
        await member.getByRole("button", { name: "Atualizar calendário" }).click();
        await expect(member.locator(`a[href="/grupos/${id}#cronograma"]`)).toHaveCount(0);
        if (id === groupId) await expect(member.getByRole("link", { name: "Detalhar aula no grupo" })).toHaveCount(1);
      }
      await expect(member.getByTestId("calendar-empty-state")).toBeVisible();
      await expect(member.getByRole("heading", { name: "Você ainda não participa de grupos" })).toBeVisible();
    } finally {
      await logout(ownerContext, owner).catch(() => undefined);
      await logout(memberContext, member).catch(() => undefined);
      await ownerContext.close();
      await memberContext.close();
    }
  });
});

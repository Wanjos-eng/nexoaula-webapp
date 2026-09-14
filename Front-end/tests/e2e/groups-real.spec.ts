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

      await registerAndLogin(member, memberUser);
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
      await member.goto("/grupos");
      await expect(member.getByRole("link", { name: groupName })).toBeVisible();
      await member.reload();
      await expect(member.getByRole("link", { name: groupName })).toBeVisible();

      await owner.screenshot({ path: testInfo.outputPath("groups-owner-approved.png"), fullPage: true });
      await member.screenshot({ path: testInfo.outputPath("groups-member-persisted.png"), fullPage: true });
    } finally {
      await logout(ownerContext, owner).catch(() => undefined);
      await logout(memberContext, member).catch(() => undefined);
      await ownerContext.close();
      await memberContext.close();
    }
  });
});
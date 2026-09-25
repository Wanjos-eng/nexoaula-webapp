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
  return {
    email: `e2e-chat-${role}-${id}@example.com`,
    fullName: `Chat E2E ${role}`,
  };
}

async function registerAndLogin(page: Page, user: User) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill(user.fullName);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/inicio$/, { timeout: 10_000 });
}

async function postJson<T>(page: Page, path: string, body: unknown): Promise<T> {
  const response = await page.request.post(`/api/v1/${path}`, {
    data: body,
    headers: csrfHeaders,
  });
  expect(response.ok(), `${path} respondeu ${response.status()}`).toBe(true);
  return response.json() as Promise<T>;
}

async function logout(context: BrowserContext, page: Page) {
  await page.request.post("/api/v1/auth/logout", {
    data: {},
    headers: csrfHeaders,
  });
  await context.clearCookies();
}

test.describe("chat de canais com API e PostgreSQL reais", () => {
  test("dois membros conversam, respondem, editam, removem e preservam o histórico", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();

    const ownerUser = uniqueUser("organizador");
    const memberUser = uniqueUser("participante");

    try {
      await registerAndLogin(owner, ownerUser);

      const suffix = uniqueId();
      const institution = await postJson<{ id: string }>(
        owner,
        "academic/institutions",
        {
          name: `Universidade Chat E2E ${suffix}`,
          shortName: `CHAT${suffix.slice(-4)}`,
        },
      );
      const subject = await postJson<{ id: string }>(
        owner,
        "academic/subjects",
        {
          institutionId: institution.id,
          name: `Comunicação E2E ${suffix}`,
          code: `CHAT-${suffix.slice(-6)}`,
        },
      );
      const group = await postJson<{ id: string }>(owner, "groups", {
        name: `Comunidade Chat ${suffix}`,
        description: "Grupo real para validar o chat persistido.",
        visibility: "public",
        joinPolicy: "open",
        disciplineId: subject.id,
      });
      const channel = await postJson<{ id: string }>(
        owner,
        `groups/${group.id}/channels`,
        {
          name: "geral",
          description: "Conversa principal do teste E2E.",
        },
      );

      await registerAndLogin(member, memberUser);
      await postJson(member, `groups/${group.id}/join`, {});

      const groupUrl = `/grupos/${group.id}`;
      await owner.goto(groupUrl);
      await member.goto(groupUrl);

      await expect(
        owner.getByRole("heading", { name: "Conversas da comunidade" }),
      ).toBeVisible();
      await expect(
        member.getByRole("heading", { name: "Conversas da comunidade" }),
      ).toBeVisible();

      const ownerComposer = owner.getByLabel("Mensagem para #geral");
      await ownerComposer.fill("Mensagem inicial do organizador");
      await owner.getByRole("button", { name: "Enviar mensagem" }).click();
      await expect(owner.getByText("Mensagem inicial do organizador")).toBeVisible();

      await member.bringToFront();
      await expect(member.getByText("Mensagem inicial do organizador")).toBeVisible({
        timeout: 12_000,
      });

      const memberOriginal = member
        .locator("article")
        .filter({ hasText: "Mensagem inicial do organizador" });
      await memberOriginal.getByRole("button", { name: "Responder" }).click();
      await expect(
        member.getByText(`Respondendo a ${ownerUser.fullName}`),
      ).toBeVisible();
      await member.getByLabel("Mensagem para #geral").fill("Resposta do participante");
      await member.getByRole("button", { name: "Enviar mensagem" }).click();
      await expect(member.getByText("Resposta do participante")).toBeVisible();

      await owner.bringToFront();
      await expect(owner.getByText("Resposta do participante")).toBeVisible({
        timeout: 12_000,
      });

      const ownerOriginal = owner
        .locator("article")
        .filter({ hasText: "Mensagem inicial do organizador" });
      await ownerOriginal.getByRole("button", { name: "Editar" }).click();
      const editDialog = owner.getByRole("dialog");
      await editDialog.getByLabel("Conteúdo").fill("Mensagem inicial editada");
      await editDialog.getByRole("button", { name: "Salvar edição" }).click();
      await expect(owner.getByText("Mensagem inicial editada")).toBeVisible();

      await member.bringToFront();
      await expect(member.getByText("Mensagem inicial editada").first()).toBeVisible({
        timeout: 12_000,
      });

      const editedArticle = owner
        .locator("article")
        .filter({ hasText: "Mensagem inicial editada" });
      await editedArticle.getByRole("button", { name: "Excluir" }).click();
      await owner
        .getByRole("dialog")
        .getByRole("button", { name: "Excluir mensagem" })
        .click();
      await expect(owner.getByText("Mensagem removida").first()).toBeVisible();

      await member.bringToFront();
      await expect(member.getByText("Mensagem removida").first()).toBeVisible({
        timeout: 12_000,
      });

      await member.reload();
      await expect(
        member.getByRole("heading", { name: "Conversas da comunidade" }),
      ).toBeVisible();
      await expect(member.getByText("Resposta do participante")).toBeVisible();
      await expect(member.getByText("Mensagem removida").first()).toBeVisible();

      const archive = await owner.request.post(
        `/api/v1/groups/${group.id}/channels/${channel.id}/archive`,
        { data: {}, headers: csrfHeaders },
      );
      expect(archive.ok()).toBe(true);

      await owner.reload();
      await expect(
        owner.getByText(
          "Este canal foi arquivado. O histórico continua disponível em modo somente leitura.",
        ),
      ).toBeVisible();
      await expect(owner.getByLabel("Mensagem para #geral")).toHaveCount(0);
      await expect(owner.getByText("Resposta do participante")).toBeVisible();
    } finally {
      await logout(ownerContext, owner).catch(() => undefined);
      await logout(memberContext, member).catch(() => undefined);
      await ownerContext.close();
      await memberContext.close();
    }
  });
});

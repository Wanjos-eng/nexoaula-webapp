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
    email: `e2e-access-${role}-${id}@example.com`,
    fullName: `Acesso E2E ${role}`,
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

async function createAcademicContext(page: Page, suffix: string) {
  const institution = await postJson<{ id: string }>(
    page,
    "academic/institutions",
    {
      name: `Universidade Access E2E ${suffix}`,
      shortName: `ACC${suffix.slice(-4)}`,
    },
  );
  const subject = await postJson<{ id: string }>(
    page,
    "academic/subjects",
    {
      institutionId: institution.id,
      name: `Comunidades E2E ${suffix}`,
      code: `ACC-${suffix.slice(-6)}`,
    },
  );
  return subject;
}

async function logout(context: BrowserContext, page: Page) {
  await page.request.post("/api/v1/auth/logout", {
    data: {},
    headers: csrfHeaders,
  });
  await context.clearCookies();
}

test.describe("ciclo completo de acesso às comunidades", () => {
  test("convite direcionado libera acesso, membro sai e pedido pendente pode ser cancelado", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();
    const ownerUser = uniqueUser("organizador");
    const memberUser = uniqueUser("convidado");

    try {
      await registerAndLogin(owner, ownerUser);
      await registerAndLogin(member, memberUser);

      const suffix = uniqueId();
      const subject = await createAcademicContext(owner, suffix);
      const privateGroup = await postJson<{ id: string; name: string }>(
        owner,
        "groups",
        {
          name: `Comunidade privada ${suffix}`,
          description: "Comunidade usada para demonstrar convite real.",
          visibility: "private",
          joinPolicy: "invite_only",
          disciplineId: subject.id,
        },
      );

      await owner.goto(`/grupos/${privateGroup.id}`);
      await expect(
        owner.getByRole("heading", { name: "Convites" }),
      ).toBeVisible();

      await owner.getByLabel("E-mail da pessoa").fill(memberUser.email);
      await owner.getByRole("button", { name: "Gerar convite" }).click();
      await expect(
        owner.getByText("Convite criado. Copie o link e envie para a pessoa convidada."),
      ).toBeVisible();

      const inviteLink = await owner.getByLabel("Link do convite").inputValue();
      expect(inviteLink).toContain("/convites/");

      await member.goto(inviteLink);
      await expect(
        member.getByRole("heading", { name: new RegExp(`Entrar em ${privateGroup.name}`) }),
      ).toBeVisible();
      await member.getByRole("button", { name: "Aceitar convite" }).click();

      await expect(
        member.getByRole("heading", { name: "Você entrou na comunidade" }),
      ).toBeVisible();
      await member.getByRole("link", { name: "Abrir comunidade" }).click();

      await expect(member).toHaveURL(new RegExp(`/grupos/${privateGroup.id}`));
      await expect(
        member.getByRole("heading", { name: "Conversas da comunidade" }),
      ).toBeVisible();

      await member.getByRole("button", { name: "Sair da comunidade" }).click();
      const leaveDialog = member.getByRole("dialog");
      await expect(
        leaveDialog.getByRole("heading", { name: "Sair desta comunidade?" }),
      ).toBeVisible();
      await leaveDialog.getByRole("button", { name: "Confirmar saída" }).click();
      await expect(member).toHaveURL(/\/grupos$/);

      const moderatedGroup = await postJson<{ id: string; name: string }>(
        owner,
        "groups",
        {
          name: `Comunidade moderada ${suffix}`,
          description: "Comunidade usada para demonstrar cancelamento de pedido.",
          visibility: "public",
          joinPolicy: "approval_required",
          disciplineId: subject.id,
        },
      );

      await member.goto(`/grupos/${moderatedGroup.id}`);
      await member.getByRole("button", { name: "Solicitar entrada" }).click();
      await expect(
        member.getByRole("heading", { name: "Solicitação pendente" }),
      ).toBeVisible();

      await member.getByRole("button", { name: "Cancelar solicitação" }).click();
      const cancelDialog = member.getByRole("dialog");
      await expect(
        cancelDialog.getByRole("heading", {
          name: "Cancelar solicitação de entrada?",
        }),
      ).toBeVisible();
      await cancelDialog
        .getByRole("button", { name: "Cancelar solicitação" })
        .click();

      await expect(
        member.getByText(
          "Solicitação cancelada. Você pode pedir entrada novamente quando quiser.",
        ),
      ).toBeVisible();
      await expect(
        member.getByRole("button", { name: "Solicitar entrada" }),
      ).toBeVisible();
    } finally {
      await logout(ownerContext, owner).catch(() => undefined);
      await logout(memberContext, member).catch(() => undefined);
      await ownerContext.close();
      await memberContext.close();
    }
  });
});

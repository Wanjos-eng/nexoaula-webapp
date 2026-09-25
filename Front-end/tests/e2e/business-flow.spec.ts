import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "senha-e2e-segura";
const PRICE_BRL = 25;
const COMMISSION_RATE = 0.15;

function fmtBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const priceCents = PRICE_BRL * 100;
const commissionCents = Math.round(priceCents * COMMISSION_RATE); // 375 → R$ 3,75
const csrfHeaders = {
  "X-NexoAula-CSRF": "1",
  Origin: "http://localhost:3000",
};

function uniqueUser() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `business-e2e-${id}@example.com`,
    fullName: "Tutor de Negócio E2E",
  };
}

async function registerAndLogin(page: Page) {
  const user = uniqueUser();
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill(user.fullName);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("status")).toContainText("Conta criada com sucesso");
  await page.waitForURL(/\/login$/);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  return user;
}

async function prepareSubject(page: Page): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const institutionResponse = await page.request.post("/api/v1/academic/institutions", {
    data: { name: `Universidade Marketplace ${suffix}`, shortName: `M${suffix.slice(-5)}` },
    headers: csrfHeaders,
  });
  expect(institutionResponse.ok()).toBe(true);
  const institution = await institutionResponse.json() as { id: string };
  const subjectResponse = await page.request.post("/api/v1/academic/subjects", {
    data: {
      institutionId: institution.id,
      name: `Disciplina Marketplace ${suffix}`,
      code: `MKT-${suffix.slice(-6)}`,
    },
    headers: csrfHeaders,
  });
  expect(subjectResponse.ok()).toBe(true);
  const subject = await subjectResponse.json() as { id: string };
  return subject.id;
}

test.describe("incremento de negócio simulado", () => {
  test("publica, encontra, inscreve, duplica, cancela e verifica lotação", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await registerAndLogin(page);
    const subjectId = await prepareSubject(page);

    await page.goto("/tutor");
    await page.getByRole("button", { name: "Ativar perfil profissional" }).click();
    await page.getByLabel("Título profissional").fill("Tutor E2E de Estruturas");
    await page.getByRole("button", { name: "Confirmar ativação" }).click();
    await page.getByRole("link", { name: "Nova sessão" }).click();

    const title = `Sessão E2E ${Date.now()}`;
    await page.getByLabel("Título da sessão").fill(title);
    await page.getByLabel("Disciplina").selectOption(subjectId);
    await page.getByLabel("Data e horário").fill("2099-09-20T18:00");
    await page.getByLabel("Término").fill("2099-09-20T19:00");
    await page.getByLabel("Link demonstrativo (online ou híbrida)").fill("https://example.com/e2e");
    await page.getByLabel("Capacidade").fill("1");
    await page.getByLabel("Valor demonstrativo (R$)").fill(String(PRICE_BRL));
    await page.getByRole("button", { name: "Revisar oferta" }).click();

    await expect(page.getByRole("heading", { name: "Resumo da oferta" })).toBeVisible();
    await expect(page.getByText(/Comissão simulada \(15%\)/)).toBeVisible();
    await page.getByRole("button", { name: "Publicar sessão simulada" }).click();

        const publishStatus = page
      .getByRole("region", { name: "Resumo da oferta" })
      .getByRole("status");
    await expect(publishStatus).toContainText("disponível na vitrine");

    await page.getByRole("link", { name: "Ver vitrine de sessões" }).click();
    await page.getByRole("searchbox").fill(title);
    await page.getByRole("link", { name: "Ver detalhes" }).click();

    await page.getByRole("button", { name: "Simular Inscrição" }).click();
    await expect(page.getByRole("dialog")).toContainText("Nenhum pagamento será cobrado");
    await page.getByRole("button", { name: "Confirmar" }).click();

    const receipt = page.getByRole("status", { name: "Recibo de inscrição simulada" });
    await expect(receipt).toContainText("Nenhum pagamento foi processado");
    await expect(receipt).toContainText(fmtBrl(commissionCents));

    await page.getByRole("button", { name: "Cancelar inscrição" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Inscrição cancelada" }),
    ).toBeVisible();

    await page.goto("/sessoes");
    await page.getByRole("searchbox").fill(title);
    await expect(page.getByRole("link", { name: "Ver detalhes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver detalhes" })).not.toHaveAttribute("aria-disabled", "true");

    await page.goto("/grupos");
    await expect(page.getByRole("main")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("business-flow.png"), fullPage: true });
  });

  test("recusa uma segunda inscrição ativa na mesma sessão", async ({ page }) => {
    await registerAndLogin(page);
    const subjectId = await prepareSubject(page);
    await page.goto("/tutor");
    await page.getByRole("button", { name: "Ativar perfil profissional" }).click();
    await page.getByLabel("Título profissional").fill("Tutor E2E de Duplicidade");
    await page.getByRole("button", { name: "Confirmar ativação" }).click();
    await page.getByRole("link", { name: "Nova sessão" }).click();

    const title = `Duplicidade E2E ${Date.now()}`;
    await page.getByLabel("Título da sessão").fill(title);
    await page.getByLabel("Disciplina").selectOption(subjectId);
    await page.getByLabel("Data e horário").fill("2099-09-20T18:00");
    await page.getByLabel("Término").fill("2099-09-20T19:00");
    await page.getByLabel("Link demonstrativo (online ou híbrida)").fill("https://example.com/duplicidade");
    await page.getByLabel("Capacidade").fill("2");
    await page.getByLabel("Valor demonstrativo (R$)").fill(String(PRICE_BRL));
    await page.getByRole("button", { name: "Revisar oferta" }).click();
    await page.getByRole("button", { name: "Publicar sessão simulada" }).click();
    await page.getByRole("link", { name: "Ver vitrine de sessões" }).click();
    await page.getByRole("searchbox").fill(title);
    await page.getByRole("link", { name: "Ver detalhes" }).click();

    await page.getByRole("button", { name: "Simular Inscrição" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("status", { name: "Recibo de inscrição simulada" })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Simular Inscrição" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "já possui inscrição ativa" }),
    ).toBeVisible();
  });

  test("não expõe credenciais ou campos financeiros reais", async ({ page }) => {
    const responses: string[] = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (!url.includes("/api/v1/")) return;
      try {
        responses.push(`${url}\n${await response.text()}`);
      } catch {
        responses.push(`${url}\n<binary-or-empty-body>`);
      }
    });

    await registerAndLogin(page);
    await page.goto("/tutor/nova-sessao");

    await expect(page.getByText(/Nenhum pagamento ou repasse real será realizado/)).toBeVisible();

    const inputNames = await page.locator("input").evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("name") ?? ""),
    );
    expect(inputNames.some((name) => /pix|cpf|cart[aã]o|banc/i.test(name))).toBe(false);

        expect(responses.join("\n")).not.toMatch(/pix|cpf|cart[aã]o|bank_account|card_number|gateway|checkout|invoice|payment_method|account_number/i);
    expect(responses.join("\n")).not.toMatch(/password|password_hash|token/i);
  });
});
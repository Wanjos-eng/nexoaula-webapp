import { expect, test, type Page } from "@playwright/test";

const password = "senha-e2e-segura";

function uniqueUser() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { email: `e2e-${id}@example.test`, fullName: "Estudante E2E" };
}

async function register(page: Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill(user.fullName);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
}

test.describe("autenticação real", () => {
  test("cadastra, rejeita duplicidade e acessa a área interna", async ({ page, context }) => {
    const user = uniqueUser();
    const responses: string[] = [];
    page.on("response", async (response) => {
      if (response.url().includes("/api/v1/auth/")) responses.push(await response.text());
    });

    await register(page, user);
    await expect(page.getByRole("status")).toContainText("Conta criada com sucesso");
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });

    await register(page, user);
    await expect(page.getByRole("status")).toContainText("já está em uso");

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/inicio$/, { timeout: 5_000 });
    await expect(page.getByRole("heading", { name: "Próxima aula" })).toBeVisible();

    const session = (await context.cookies()).find((cookie) => cookie.name.includes("nexoaula_session"));
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    expect(responses.every((body) => !body.includes(password) && !body.includes("password_hash"))).toBe(true);
  });

  test("usa mensagem genérica para conta inexistente e senha incorreta", async ({ page }) => {
    for (const email of [`missing-${Date.now()}@example.test`, "nobody@example.test"]) {
      await page.goto("/login");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("status")).toHaveText("E-mail ou senha incorretos.");
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("envia CSRF e logout limpa o cookie do navegador", async ({ page, context }) => {
    const user = uniqueUser();
    await register(page, user);
    await page.waitForURL(/\/login$/);
    const loginRequest = page.waitForRequest("**/api/v1/auth/login");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    expect((await loginRequest).headers()["x-nexoaula-csrf"]).toBe("1");
    await page.waitForURL(/\/inicio$/);

    const logoutResponse = await page.request.post("/api/v1/auth/logout", {
      data: {},
      headers: { Origin: new URL(page.url()).origin, "X-NexoAula-CSRF": "1" },
    });
    expect(logoutResponse.status()).toBe(204);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).some((cookie) => cookie.name.includes("nexoaula_session"))).toBe(false);
  });
});
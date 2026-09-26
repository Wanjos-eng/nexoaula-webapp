import { expect, test, type Page } from "@playwright/test";

test("organizador agenda, membro confirma sem duplicar e cancelamento chega ao calendário", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const headers = { Origin: new URL(baseURL!).origin, "X-NexoAula-CSRF": "1" };
  const ownerContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  const owner = await ownerContext.newPage(), member = await memberContext.newPage();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  async function post(page: Page, path: string, data: object) {
    const result = await page.request.post(`/api/v1/${path}`, { data, headers });
    expect(result.ok(), await result.text()).toBe(true);
    return result.json();
  }
  async function login(page: Page, role: string) {
    const email = `meeting-${role}-${suffix}@example.com`, password = "review-meeting-password";
    await post(page, "auth/register", { fullName: `Teste ${role}`, email, password });
    await post(page, "auth/login", { email, password });
  }
  try {
    await login(owner, "organizador");
    await login(member, "membro");
    const institution = await post(owner, "academic/institutions", { name: `Instituição ${suffix}` });
    const subject = await post(owner, "academic/subjects", { institutionId: institution.id, name: `Disciplina ${suffix}` });
    const group = await post(owner, "groups", { name: `Grupo ${suffix}`, disciplineId: subject.id, joinPolicy: "open" });
    await post(member, `groups/${group.id}/join`, {});
    await owner.goto(`/grupos/${group.id}`);
    await owner.getByRole("button", { name: "Agendar encontro", exact: true }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByLabel("Título", { exact: true }).fill("Revisão do grupo");
    await dialog.getByLabel("Link externo").fill("https://example.org/reuniao");
    const start = new Date(Date.now() + 10 * 60_000), end = new Date(Date.now() + 70 * 60_000);
    const local = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
    await dialog.getByLabel("Início", { exact: true }).fill(local(start));
    await dialog.getByLabel("Fim", { exact: true }).fill(local(end));
    await dialog.getByRole("button", { name: "Agendar encontro", exact: true }).click();
    await owner.reload();
    await expect(owner.getByRole("heading", { name: "Revisão do grupo", exact: true })).toBeVisible();
    await member.goto(`/grupos/${group.id}`);
    await member.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(member.getByText("Sua participação: Confirmada")).toBeVisible();
    await member.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(member.getByLabel("1 pessoas confirmadas")).toBeVisible();
    await expect(member.getByRole("button", { name: "Registrar minha presença" })).toHaveCount(0);
    await owner.reload();
    await expect(owner.getByLabel("1 pessoas confirmadas")).toBeVisible();
    await owner.getByRole("button", { name: "Editar", exact: true }).click();
    await owner.getByRole("dialog").getByLabel("Título", { exact: true }).fill("Revisão atualizada");
    await owner.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await owner.reload();
    await expect(owner.getByRole("heading", { name: "Revisão atualizada", exact: true })).toBeVisible();
    await member.goto("/calendario");
    await expect(
      member.getByRole("heading", { name: "Revisão atualizada", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await owner.getByRole("button", { name: "Cancelar encontro", exact: true }).click();
    await owner.getByRole("button", { name: "Confirmar cancelamento", exact: true }).click();
    await member.reload();
    await expect(member.getByText("Encontro (Cancelado)", { exact: true })).toBeVisible();
    await member.goto(`/grupos/${group.id}`);
    await expect(member.getByRole("button", { name: "Confirmar", exact: true })).toHaveCount(0);
    await expect(member.getByRole("heading", { name: "Revisão atualizada", exact: true })).toBeVisible();
  } finally {
    await ownerContext.close();
    await memberContext.close();
  }
});

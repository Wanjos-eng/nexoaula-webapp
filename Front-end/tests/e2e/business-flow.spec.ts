import { expect, test, type Page } from "@playwright/test";

const password = "senha-e2e-segura";
async function register(page: Page, role: string) {
  const email = `market-${role}-${Date.now()}-${Math.random().toString(36).slice(2,8)}@example.com`;
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill(`Estudante ${role}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/login$/);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/inicio$/);
}
function headers(page: Page) { return { Origin: new URL(page.url()).origin, "X-NexoAula-CSRF": "1", "Content-Type": "application/json" }; }
async function post(page: Page, path: string, data: unknown) {
  const response = await page.request.post(`/api/v1/${path}`, { data, headers: headers(page) });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test("publicação, inscrição e histórico persistidos entre tutor e alunos reais", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const tutorContext = await browser.newContext();
  const studentContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const tutor = await tutorContext.newPage(), student = await studentContext.newPage(), other = await otherContext.newPage();
  for (const page of [tutor, student, other]) page.setDefaultTimeout(15_000);
  try {
    await register(tutor, "tutor");
    const suffix = Date.now();
    const institution = await post(tutor, "academic/institutions", { name: `Instituição ${suffix}` });
    const subject = await post(tutor, "academic/subjects", { institutionId: institution.id, name: `Assunto ${suffix}` });
    await tutor.goto("/tutor");
    await tutor.getByRole("button", { name: "Ativar perfil" }).click();
    await tutor.getByLabel("Título profissional").fill("Tutor de cálculo");
    await tutor.getByRole("button", { name: "Confirmar ativação" }).click();
    await tutor.getByRole("link", { name: "Criar tutoria" }).click();
    const title = `Sessão real ${suffix}`;
    await tutor.getByLabel("Título da tutoria").fill(title);
    await tutor.getByRole("combobox", { name: "Disciplina", exact: true }).selectOption(subject.id);
    await tutor.getByLabel("Data e horário").fill("2099-09-20T18:00");
    await tutor.getByLabel("Término").fill("2099-09-20T19:00");
    await tutor.getByLabel("Link do encontro (online ou híbrida)").fill("https://example.test/aula");
    await tutor.getByLabel("Capacidade").fill("1");
    await tutor.getByLabel("Valor (R$)").fill("25");
    await tutor.getByRole("button", { name: "Revisar tutoria" }).click();
    await tutor.getByRole("button", { name: "Publicar tutoria" }).click();
    await expect(tutor.getByText("Sua tutoria já está disponível para os estudantes.")).toBeVisible();
    await tutor.goto("/tutor"); await tutor.reload();
    await expect(tutor.getByRole("heading", { name: title })).toBeVisible();
    await register(student, "aluno");
    await student.goto("/sessoes");
    await student.getByRole("searchbox").fill(title);
    await student.getByRole("link", { name: "Ver tutoria" }).click();
    await student.waitForURL(/\/sessoes\/[0-9a-f-]+$/);
    const detailUrl = student.url(), sessionId = new URL(detailUrl).pathname.split("/").pop();
    await student.getByRole("button", { name: "Reservar vaga" }).click();
    await student.getByRole("button", { name: "Confirmar simulação", exact: true }).click();
    const receipt = student.getByRole("status", { name: "Reserva de tutoria confirmada" });
    await expect(receipt).toContainText("Nenhum pagamento foi processado");
    await student.reload(); await expect(receipt).toBeVisible();
    const duplicate = await student.request.post(`/api/v1/marketplace/sessions/${sessionId}/enroll`, { data: {}, headers: headers(student) });
    expect(duplicate.status()).toBe(409);
    await register(other, "outro"); await other.goto(detailUrl);
    await expect(other.getByRole("button", { name: "Vagas esgotadas" })).toBeDisabled();
    const full = await other.request.post(`/api/v1/marketplace/sessions/${sessionId}/enroll`, { data: {}, headers: headers(other) });
    expect(full.status()).toBe(409);
    await student.getByRole("button", { name: "Cancelar reserva" }).click();
    await student.getByRole("button", { name: "Cancelar reserva", exact: true }).last().click();
    await expect(student.getByText("Reserva cancelada")).toBeVisible();
    await other.reload();
    await expect(other.getByRole("button", { name: "Reservar vaga" })).toBeEnabled();
    await student.getByRole("button", { name: "Reservar novamente" }).click();
    await student.getByRole("button", { name: "Confirmar simulação", exact: true }).click();
    await expect(receipt).toBeVisible();
    await student.goto("/sessoes/minhas"); await student.reload();
    await student.getByRole("tab", { name: /Histórico/ }).click();
    const history = student.getByRole("list", { name: "Histórico de tutorias" });
    await expect(history.getByRole("listitem")).toHaveCount(1);
    await expect(history).toContainText("Cancelada");
    await student.getByRole("tab", { name: /Próximas/ }).click();
    const upcoming = student.getByRole("list", { name: "Próximas tutorias" });
    await expect(upcoming.getByRole("listitem")).toHaveCount(1);
    await expect(upcoming).toContainText("Confirmada");
    const persisted = await student.request.get("/api/v1/marketplace/bookings/mine");
    const records = await persisted.json();
    expect(records).toHaveLength(2);
    expect(records.every((r: { simulated: boolean; transaction: { amount_cents: number; commission_cents: number } }) => r.simulated && r.transaction.amount_cents === 2500 && r.transaction.commission_cents === 375)).toBe(true);
    expect(await student.evaluate(() => Object.keys({ ...sessionStorage, ...localStorage }).filter((key) => /demo-bookings|demo-sessions/.test(key)))).toEqual([]);
    await student.screenshot({ path: info.outputPath("marketplace-persisted.png"), fullPage: true });
    await tutor.goto("/tutor");
    await tutor.getByRole("button", { name: "Cancelar", exact: true }).click();
    await tutor.getByRole("button", { name: "Cancelar tutoria", exact: true }).click();
    await expect(tutor.getByText("Tutoria cancelada.")).toBeVisible();
    await tutor.getByRole("tab", { name: /Histórico/ }).click();
    await expect(tutor.getByText("Cancelada", { exact: true })).toBeVisible();
    await student.reload(); await expect(student.getByText("Confirmada", { exact: true })).toHaveCount(0);
  } finally { await tutorContext.close(); await studentContext.close(); await otherContext.close(); }
});

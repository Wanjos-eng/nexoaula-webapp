import { expect, test } from "@playwright/test";

const session = {
  id: "session-qa",
  tutor_user_id: "tutor",
  tutor_name: "Tutor QA",
  subject_id: "subject-qa",
  subject_name: "Cálculo",
  title: "Revisão de Cálculo",
  description: "Revisão de limites e derivadas para o pitch.",
  modality: "online",
  location: null,
  external_url: "https://example.test/aula",
  starts_at: "2099-10-20T18:00:00Z",
  ends_at: "2099-10-20T19:00:00Z",
  capacity: 8,
  enrolled_count: 2,
  available_seats: 6,
  price_cents: 2500,
  commission_cents: 375,
  currency: "BRL",
  status: "scheduled",
} as const;

const tutorOffer = {
  id: "offer-qa",
  tutor_user_id: "ana",
  subject_id: "subject-qa",
  title: "Álgebra Linear",
  description: "Matrizes e sistemas lineares.",
  modality: "hybrid",
  location: "Sala 12",
  external_url: "https://example.test/algebra",
  starts_at: "2099-11-10T18:00:00Z",
  ends_at: "2099-11-10T19:00:00Z",
  capacity: 10,
  price_cents: 3000,
  currency: "BRL",
  status: "scheduled",
} as const;

for (const width of [1440, 1024, 768, 390]) {
  test(`marketplace e área do tutor sem overflow em ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 960 });

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      let body: unknown;

      if (path.endsWith("/auth/me")) {
        body = {
          id: "ana",
          fullName: "Ana Silva",
          email: "ana@example.com",
          createdAt: "2026-09-14T10:00:00Z",
        };
      } else if (path.endsWith("/academic/subjects")) {
        body = [{ id: "subject-qa", name: "Cálculo" }];
      } else if (
        path.endsWith("/marketplace/sessions/session-qa") &&
        request.method() === "GET"
      ) {
        body = session;
      } else if (
        path.endsWith("/marketplace/bookings/mine") &&
        request.method() === "GET"
      ) {
        body = [];
      } else if (
        path.endsWith("/marketplace/sessions/mine") &&
        request.method() === "GET"
      ) {
        body = [tutorOffer];
      } else if (
        path.endsWith("/marketplace/tutor") &&
        request.method() === "GET"
      ) {
        body = {
          user_id: "ana",
          headline: "Tutora de exatas",
          bio: "Aulas objetivas com foco em resolução de exercícios.",
          status: "active",
          created_at: "2026-09-20T10:00:00Z",
        };
      } else if (
        path.endsWith("/marketplace/sessions") &&
        request.method() === "GET"
      ) {
        body = [session];
      } else {
        throw new Error(`Unexpected API call: ${request.method()} ${path}`);
      }

      await route.fulfill({ json: body });
    });

    async function assertResponsive(name: string) {
      await expect(page.locator("main")).toBeVisible();
      await expect.poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        { message: `${name} não deve criar overflow horizontal` },
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
        style: "nextjs-portal { display: none; }",
      });
    }

    await page.goto("/sessoes");
    await expect(page.getByRole("heading", { name: "Tutorias" })).toBeVisible();
    await assertResponsive("tutorias");

    await page.goto("/sessoes/session-qa");
    await expect(
      page.getByRole("heading", { name: "Revisão de Cálculo" }),
    ).toBeVisible();
    await assertResponsive("tutoria-detalhe");

    await page.goto("/sessoes/minhas");
    await expect(
      page.getByRole("heading", { name: "Minhas tutorias" }),
    ).toBeVisible();
    await assertResponsive("minhas-tutorias");

    await page.goto("/tutor");
    await expect(
      page.getByRole("heading", { name: "Área do Tutor" }),
    ).toBeVisible();
    await assertResponsive("area-tutor");

    await page.goto("/tutor/nova-sessao");
    await expect(
      page.getByRole("heading", { name: "Criar tutoria" }),
    ).toBeVisible();
    await assertResponsive("criar-tutoria");
  });
}

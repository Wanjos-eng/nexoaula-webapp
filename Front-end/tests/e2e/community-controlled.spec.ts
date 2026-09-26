import { expect, test } from "@playwright/test";

// Browser integration evidence with controlled HTTP responses; not a substitute for PostgreSQL E2E.
for (const width of [1440, 1024, 768, 390]) {
  test(`perfil, criação, descoberta e participação em ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 960 });
    let profile = {
      userId: "ana",
      displayName: "Ana Silva",
      institutionId: "institution",
      courseId: "course",
      bio: "Engenharia, matemática e boas conversas.",
    };
    let group = {
      id: "study-group",
      name: "Cálculo em companhia",
      description:
        "Um espaço para resolver listas, compartilhar dúvidas e construir uma base sólida em cálculo. Encontros de estudo com foco em limites e derivadas.",
      rules:
        "Respeite o ritmo de cada pessoa. Compartilhe tentativas e explique seu raciocínio.",
      disciplineId: "subject",
      offeringId: "section",
      visibility: "public",
      joinPolicy: "approval_required",
      ownerId: "organizer",
      status: "active",
      subjectName: "Cálculo diferencial",
      period: "2026.2",
      capacity: null,
    };
    let participation = {
      status: "none",
      role: null as string | null,
      canManage: false,
      memberCount: 4,
    };
    let requested = false;
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      let body: unknown;
      if (path.endsWith("/auth/me"))
        body = {
          id: "ana",
          fullName: "Ana Silva",
          email: "ana@example.com",
          createdAt: "2026-09-14T10:00:00Z",
        };
      else if (path.endsWith("/academic/profile")) {
        if (request.method() === "PATCH")
          profile = { ...profile, ...request.postDataJSON() };
        body = profile;
      } else if (path.endsWith("/academic/institutions"))
        body = [{ id: "institution", name: "Universidade Federal" }];
      else if (path.endsWith("/academic/courses"))
        body = [
          { id: "course", name: "Engenharia", institutionId: "institution" },
        ];
      else if (path.endsWith("/academic/subjects"))
        body = [{ id: "subject", name: "Cálculo diferencial" }];
      else if (path.endsWith("/academic/class-sections"))
        body = [
          {
            id: "section",
            label: "Turma A",
            subjectId: "subject",
            academicTermId: "term",
          },
        ];
      else if (path.endsWith("/academic/academic-terms"))
        body = [{ id: "term", label: "2026.2" }];
      else if (path.endsWith("/academic/teachers"))
        body = [
          {
            id: "teacher",
            institutionId: "institution",
            fullName: "Professora Ada",
          },
        ];
      else if (path.endsWith("/academic/class-section-teachers"))
        body = [
          {
            id: "assignment",
            institutionId: "institution",
            classSectionId: "section",
            teacherId: "teacher",
            role: "lead",
            startsOn: "2026-08-01",
            endsOn: null,
          },
        ];
      else if (path.endsWith("/academic/topics"))
        body = [
          {
            id: "topic",
            slug: "limites",
            name: "Limites",
            description: null,
          },
        ];
      else if (path.endsWith("/academic/subject-topics"))
        body = [
          {
            id: "subject-topic",
            subjectId: "subject",
            topicId: "topic",
            displayOrder: 0,
          },
        ];
      else if (path.endsWith("/join")) {
        expect(request.headers()["content-type"]).toContain("application/json");
        expect(request.headers()["x-nexoaula-csrf"]).toBe("1");
        participation = { ...participation, status: "pending" };
        body = { status: "pending" };
      } else if (path.endsWith("/participation")) body = participation;
      else if (path.endsWith("/members"))
        body =
          url.searchParams.get("pending") === "true" && !requested
            ? [
                {
                  userId: "beatriz",
                  displayName: "Beatriz Santos",
                  status: "pending",
                  role: null,
                },
              ]
            : [];
      else if (path.endsWith("/members/beatriz")) {
        requested = true;
        participation.memberCount++;
        body = { status: "active" };
      } else if (path.endsWith("/groups/mine"))
        body = participation.status === "active" ? [group] : [];
      else if (path.endsWith("/groups/me/lessons")) body = [];
      else if (path.endsWith("/me/meetings")) body = [];
      else if (path.endsWith("/marketplace/bookings/mine")) body = [];
      else if (path.endsWith("/groups") && request.method() === "POST") {
        group = { ...group, ...request.postDataJSON(), ownerId: "ana" };
        participation = {
          status: "active",
          role: "owner",
          canManage: true,
          memberCount: 1,
        };
        body = group;
      } else if (path.endsWith("/groups")) body = [group];
      else if (path.endsWith("/groups/study-group/plans") && request.method() === "GET") body = [];
      else if (path.endsWith("/groups/study-group/channels") && request.method() === "GET") body = [];
      else if (path.endsWith("/groups/study-group/invitations") && request.method() === "GET") body = [];
      else if (path.endsWith("/groups/study-group/topics") && request.method() === "GET") body = [];
      else if (path.includes("/groups/study-group/occurrences") && request.method() === "GET") body = [];
      else if (path.endsWith("/groups/study-group/planning-corrections") && request.method() === "GET") body = [];
      else if (
        path.endsWith("/groups/study-group/meetings") &&
        request.method() === "GET"
      ) body = [];
      else if (path.includes("/me/attendance-adjustments") && request.method() === "GET") body = [];
      else if (path.includes("/me/attendance") && request.method() === "GET") body = [];
      else if (path.includes("/me/progress") && request.method() === "GET") body = [];
      else if (path.endsWith("/groups/study-group")) body = group;
      else throw new Error(`Unexpected API call: ${path}`);
      await route.fulfill({ json: body });
    });
    const capture = async (name: string) => {
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
        style: "nextjs-portal { display: none; }",
      });
    };
    await page.goto("/inicio");
    await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
    await capture("home");

    await page.goto("/perfil");

    if (width <= 820) {
      const openMenu = page.getByRole("button", { name: "Abrir menu de navegação" });
      const closeMenu = page.getByRole("button", { name: "Fechar menu", exact: true });
      await openMenu.click();
      await expect(closeMenu).toBeFocused();
      await page.keyboard.press("Escape");
    }
    await expect(
      page.getByRole("heading", { name: "Ana Silva" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: /Sobre mim/ })
      .fill("Quero aprofundar meus estudos em cálculo.");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByText("Perfil atualizado com sucesso."),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Sobre mim/ })).toHaveValue(
      "Quero aprofundar meus estudos em cálculo.",
    );
    await capture("profile");
    await page.getByRole("link", { name: "Explorar comunidades" }).click();
    await page
      .getByRole("button", { name: "Descobrir", exact: true })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: group.name })).toBeVisible();
    await capture("discovery");
    await page.getByRole("link", { name: "Ver comunidade" }).click();
    await page.getByRole("button", { name: "Solicitar entrada" }).click();
    await expect(
      page.getByText(
        "Solicitação enviada. Aguarde a decisão de um organizador.",
      ),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Solicitação pendente", exact: true }),
    ).toBeVisible();
    await capture("pending");
    await page.goto("/grupos/novo");
    await expect(page.getByLabel("Nome da comunidade *")).toBeVisible();
    await page.getByLabel("Nome da comunidade *").fill("Cálculo em companhia");
    await page
      .getByLabel("Disciplina *", { exact: true })
      .selectOption("subject");
    await page.getByLabel("Turma (opcional)").selectOption("section");
    await page.getByLabel("Descrição").fill(group.description);
    await page.getByLabel("Combinados da comunidade").fill(group.rules);
    await capture("create");
    await page
      .getByRole("button", { name: "Criar comunidade", exact: true })
      .click();
    await page.getByRole("link", { name: "Acessar comunidade" }).click();
    await expect(
      page.getByRole("heading", { name: "Gerenciar participantes" }),
    ).toBeVisible();
    await expect(page.getByText("Beatriz Santos")).toBeVisible();
    await capture("organizer");
    await page.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(page.getByText("Solicitação aprovada.")).toBeVisible();
    await expect(
      page.getByText(
        "Nenhuma solicitação pendente. Os novos pedidos aparecerão aqui.",
      ),
    ).toBeVisible();

    await page.goto("/disciplinas");
    await expect(
      page.getByRole("heading", { name: "Minhas Disciplinas" }),
    ).toBeVisible();
    await expect(page.getByText("Professora Ada")).toBeVisible();
    await capture("disciplines");

    await page.goto("/calendario");
    await expect(
      page.getByRole("heading", { name: "Calendário" }),
    ).toBeVisible();
    await capture("calendar");
  });
}

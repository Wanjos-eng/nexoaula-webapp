import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InicioPage from "@/app/(app)/inicio/page";

describe("InicioPage", () => {
  it("apresenta os principais blocos acadêmicos com dados simulados", () => {
    render(<InicioPage />);

    expect(screen.getByRole("heading", { name: "Próxima aula" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Minhas disciplinas" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Meus grupos de estudo" })).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("45");
    expect(screen.getByRole("link", { name: "Descobrir grupos" }).getAttribute("href")).toBe(
      "/grupos?view=discover",
    );
    expect(screen.getByRole("link", { name: "Abrir grupo" }).getAttribute("href")).toBe(
      "/grupos/comunidade-msd-c8",
    );
  });
});

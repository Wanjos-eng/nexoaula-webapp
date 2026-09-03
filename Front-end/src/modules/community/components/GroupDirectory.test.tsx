import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { communityGroups, myStudyGroups } from "@/mocks/community/groups";

import { GroupDirectory } from "./GroupDirectory";

function renderDirectory(
  options: Partial<ComponentProps<typeof GroupDirectory>> = {},
) {
  return render(
    <GroupDirectory
      groups={communityGroups}
      initialView="discover"
      myGroups={myStudyGroups}
      {...options}
    />,
  );
}

describe("GroupDirectory", () => {
  it("filtra comunidades por disciplina e limpa os filtros", () => {
    renderDirectory();

    fireEvent.change(screen.getByRole("combobox", { name: "Disciplina" }), {
      target: { value: "Banco de Dados" },
    });

    expect(screen.getByRole("heading", { name: "Banco de Dados com PostgreSQL" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Engenharia de Software · Sprint 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(screen.getByRole("status").textContent).toContain("5 comunidades encontradas");
  });

  it("apresenta o estado sem resultados e permite recuperar a listagem", () => {
    renderDirectory();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar grupo" }), {
      target: { value: "disciplina inexistente" },
    });

    expect(screen.getByRole("heading", { name: "Nenhum grupo corresponde aos filtros" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Remover filtros e ver todos" }));
    expect(screen.getByRole("status").textContent).toContain("5 comunidades encontradas");
  });

  it("abre e fecha a prévia sem simular solicitação de entrada", () => {
    renderDirectory();

    fireEvent.click(screen.getAllByRole("button", { name: "Ver detalhes" })[0]);

    expect(screen.getByRole("dialog", { name: "Engenharia de Software · Sprint 1" })).toBeDefined();
    expect(screen.getByText(/participação real será habilitada/i)).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("suporta navegação por teclado entre as abas", () => {
    renderDirectory({ initialView: "mine" });
    const myGroupsTab = screen.getByRole("tab", { name: /Meus grupos/ });

    fireEvent.keyDown(myGroupsTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Descobrir grupos" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Filtrar comunidades" })).toBeDefined();
  });

  it("trata carregamento e erro simulado com nova tentativa", () => {
    const { unmount } = renderDirectory({ initialStatus: "loading" });
    expect(screen.getByRole("status", { name: "Carregando comunidades" })).toBeDefined();

    unmount();
    renderDirectory({ initialStatus: "error" });

    expect(screen.getByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByRole("status").textContent).toContain("5 comunidades encontradas");
  });
});

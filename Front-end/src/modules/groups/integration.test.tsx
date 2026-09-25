vi.mock("@/modules/auth", () => ({ useAuthSession: () => ({ user: { id: "owner" } }) }));
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcademicProfile } from "@/modules/academic/components/AcademicProfile";
import { GroupForm } from "./GroupForm";
import { GroupDirectory } from "./GroupDirectory";
import { GroupDetail } from "./GroupDetail";
import type { Group } from "./api";

const group: Group = {
  id: "group-1",
  name: "Estudos de Cálculo",
  description: "Listas de exercícios",
  rules: "Respeito",
  disciplineId: "subject-1",
  offeringId: null,
  visibility: "public",
  joinPolicy: "open",
  ownerId: "owner",
  status: "active",
  capacity: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
type Handler = (
  url: string,
  options: RequestInit,
) => Response | Promise<Response>;
function server(handler: Handler) {
  return vi.stubGlobal(
    "fetch",
    vi.fn((url: string, options: RequestInit) =>
      (url.includes("/plans?") || url.endsWith("/meetings") || url.includes("/topics")) ? json([]) : handler(url, options)),
  );
}
function catalogs(url: string) {
  if (url.includes("subjects?")) return [{ id: "subject-1", name: "Cálculo" }];
  if (url.includes("institutions?"))
    return [{ id: "institution-1", name: "Universidade" }];
  if (url.includes("courses?"))
    return [
      { id: "course-1", institutionId: "institution-1", name: "Engenharia" },
    ];
  return [];
}
afterEach(() => vi.unstubAllGlobals());

describe("fluxos integrados com o cliente HTTP e respostas controladas", () => {
  it("salva o perfil, envia CSRF e restaura os dados ao remontar", async () => {
    let profile = {
      userId: "user",
      displayName: "Ana",
      institutionId: null,
      courseId: null,
      bio: null,
    };
    server((url, options) => {
      if (url.endsWith("academic/profile")) {
        if (options.method === "PATCH") {
          expect(new Headers(options.headers).get("X-NexoAula-CSRF")).toBe("1");
          profile = { ...profile, ...JSON.parse(String(options.body)) };
        }
        return json(profile);
      }
      return json(catalogs(url));
    });
    const view = render(<AcademicProfile />);
    await screen.findByText("Ana");
    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: "institution-1" },
    });
    fireEvent.change(screen.getByLabelText("Curso"), {
      target: { value: "course-1" },
    });
    fireEvent.change(screen.getByLabelText(/Sobre mim/), {
      target: { value: "Álgebra e cálculo" },
    });
    fireEvent.click(screen.getByText("Salvar alterações"));
    await screen.findByText("Perfil atualizado com sucesso.");
    view.unmount();
    render(<AcademicProfile />);
    await screen.findByText("Ana");
    expect((screen.getByLabelText("Curso") as HTMLSelectElement).value).toBe(
      "course-1",
    );
    expect(
      (screen.getByLabelText(/Sobre mim/) as HTMLTextAreaElement).value,
    ).toBe("Álgebra e cálculo");
  });

  it("cria apenas uma vez enquanto a resposta está pendente e abre o ID real", async () => {
    let resolve!: (response: Response) => void;
    let posts = 0;
    server((url, options) => {
      if (options.method === "POST") {
        posts++;
        expect(JSON.parse(String(options.body))).toMatchObject({
          name: "Grupo novo",
          disciplineId: "subject-1",
          offeringId: null,
        });
        return new Promise((r) => {
          resolve = r;
        });
      }
      return json(catalogs(url));
    });
    render(<GroupForm />);
    await screen.findByText("Um objetivo em comum");
    fireEvent.change(screen.getByLabelText("Nome do grupo *"), {
      target: { value: "Grupo novo" },
    });
    fireEvent.change(screen.getByLabelText("Disciplina *"), {
      target: { value: "subject-1" },
    });
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.submit(screen.getByRole("form"));
    expect(posts).toBe(1);
    await act(async () => resolve(json(group, 201)));
    expect(
      (await screen.findByRole("link", { name: "Acessar grupo" })).getAttribute(
        "href",
      ),
    ).toBe("/grupos/group-1");
  });

  it("preserva formulário em erro de validação e permite reenviar", async () => {
    let posts = 0;
    server((url, options) =>
      options.method === "POST"
        ? ++posts === 1
          ? json(
              {
                detail:
                  "A turma informada não pertence à disciplina selecionada.",
              },
              400,
            )
          : json(group, 201)
        : json(catalogs(url)),
    );
    render(<GroupForm />);
    await screen.findByText("Um objetivo em comum");
    fireEvent.change(screen.getByLabelText("Nome do grupo *"), {
      target: { value: "Grupo novo" },
    });
    fireEvent.change(screen.getByLabelText("Disciplina *"), {
      target: { value: "subject-1" },
    });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText(
      "A turma informada não pertence à disciplina selecionada.",
    );
    expect(
      (screen.getByLabelText("Nome do grupo *") as HTMLInputElement).value,
    ).toBe("Grupo novo");
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("Grupo criado");
  });

  it("envia filtros à API, pagina e apresenta estado vazio útil", async () => {
    const urls: string[] = [];
    server((url) => {
      urls.push(url);
      return json(
        url.includes("subject=C") || url.includes("offset=12")
          ? []
          : Array.from({ length: 13 }, (_, i) => ({
              ...group,
              id: `group-${i}`,
            })),
      );
    });
    render(<GroupDirectory initialView="discover" />);
    await screen.findByText("Grupos para descobrir");
    fireEvent.click(screen.getByText("Próxima"));
    await screen.findByText("Nenhum grupo encontrado");
    expect(urls.at(-1)).toContain("offset=12");
    fireEvent.change(screen.getByLabelText("Disciplina"), {
      target: { value: "Cálculo" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(urls.at(-1)).toContain("subject=C%C3%A1lculo"));
    await screen.findByText("Nenhum grupo encontrado");
    expect(
      screen.getByRole("button", { name: "Remover filtros" }),
    ).toBeTruthy();
  });

  it.each(["open", "approval_required"] as const)(
    "distingue feedback de %s e restaura a participação",
    async (policy) => {
      let status = "none";
      server((url, options) => {
        if (options.method === "POST") {
          expect(new Headers(options.headers).get("Content-Type")).toBe(
            "application/json",
          );
          status = policy === "open" ? "active" : "pending";
          return json({ status }, 201);
        }
        return json(
          url.endsWith("participation")
            ? { status, role: null, canManage: false, memberCount: 1 }
            : { ...group, joinPolicy: policy },
        );
      });
      const view = render(<GroupDetail groupId="group-1" />);
      fireEvent.click(
        await screen.findByRole("button", {
          name: policy === "open" ? "Entrar no grupo" : "Solicitar entrada",
        }),
      );
      await screen.findByText(
        policy === "open"
          ? "Você entrou no grupo. Bons estudos!"
          : "Solicitação enviada. Aguarde a decisão de um organizador.",
      );
      view.unmount();
      render(<GroupDetail groupId="group-1" />);
      await screen.findByText(
        policy === "open" ? "Você participa" : "Solicitação pendente",
      );
      expect(screen.queryByText("Gerenciar participantes")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Entrar no grupo" }),
      ).toBeNull();
    },
  );

  it("organizador aprova e revalida uma solicitação já processada por outra sessão", async () => {
    let processed = false;
    server((url, options) => {
      if (options.method === "PATCH") {
        processed = true;
        return json({ detail: "Solicitação pendente não encontrada." }, 409);
      }
      if (url.includes("/members?"))
        return json(
          processed
            ? []
            : [
                {
                  userId: "user",
                  displayName: "Beatriz",
                  status: "pending",
                  role: null,
                },
              ],
        );
      return json(
        url.endsWith("participation")
          ? { status: "active", role: "owner", canManage: true, memberCount: 1 }
          : group,
      );
    });
    render(<GroupDetail groupId="group-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Aprovar" }));
    await screen.findByText("Solicitação pendente não encontrada.");
    await screen.findByText(
      "Nenhuma solicitação pendente. Os novos pedidos aparecerão aqui.",
    );
    expect(screen.queryByText("Beatriz")).toBeNull();
  });

  it("edita somente os campos permitidos e usa a resposta da API", async () => {
    const saved = vi.fn();
    server((url, options) => {
      if (options.method === "PATCH") {
        const body = JSON.parse(String(options.body));
        expect(body.name).toBe("Novo nome");
        expect(body).not.toHaveProperty("disciplineId");
        expect(body).not.toHaveProperty("ownerId");
        return json({ ...group, name: "Novo nome" });
      }
      return json(catalogs(url));
    });
    render(<GroupForm group={group} onSaved={saved} />);
    await screen.findByText("Configurações do grupo");
    fireEvent.change(screen.getByLabelText("Nome do grupo *"), {
      target: { value: "Novo nome" },
    });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith({ ...group, name: "Novo nome" }),
    );
  });

  it.each(["reject", "remove"])(
    "organizador executa %s e não oferece remoção do proprietário",
    async (action) => {
      let processed = false;
      server((url, options) => {
        if (options.method === "PATCH") {
          expect(JSON.parse(String(options.body))).toEqual({ action });
          processed = true;
          return json({ status: action === "reject" ? "rejected" : "removed" });
        }
        if (url.includes("/members?"))
          return json(
            processed
              ? []
              : url.includes("pending=true")
                ? [
                    {
                      userId: "user",
                      displayName: "Beatriz",
                      status: "pending",
                      role: null,
                    },
                  ]
                : [
                    {
                      userId: "owner",
                      displayName: "Ana",
                      status: "active",
                      role: "owner",
                    },
                    {
                      userId: "user",
                      displayName: "Beatriz",
                      status: "active",
                      role: "member",
                    },
                  ],
          );
        return json(
          url.endsWith("participation")
            ? {
                status: "active",
                role: "owner",
                canManage: true,
                memberCount: 2,
              }
            : group,
        );
      });
      render(<GroupDetail groupId="group-1" />);
      await screen.findByText("Beatriz");
      if (action === "remove") {
        fireEvent.click(screen.getByRole("button", { name: "Membros ativos" }));
        await screen.findByText("Ana");
        expect(screen.getAllByRole("button", { name: "Remover" })).toHaveLength(
          1,
        );
        fireEvent.click(screen.getByRole("button", { name: "Remover" }));
        expect(processed).toBe(false);
        fireEvent.click(
          screen.getByRole("button", { name: "Confirmar remoção" }),
        );
      } else fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
      await screen.findByText(
        action === "remove"
          ? "Participante removido."
          : "Solicitação recusada.",
      );
      await waitFor(() => expect(screen.queryByText("Beatriz")).toBeNull());
    },
  );

  it.each([401, 404, 503])(
    "trata erro %s sem conteúdo fictício",
    async (status) => {
      server(() => json({}, status));
      render(<GroupDetail groupId="group-1" />);
      await screen.findByRole("alert");
      if (status === 401)
        expect(
          screen.getByRole("link", { name: "Entrar novamente" }),
        ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Entrar no grupo" }),
      ).toBeNull();
      expect(screen.queryByText("Estudos de Cálculo")).toBeNull();
    },
  );
});

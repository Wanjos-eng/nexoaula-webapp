import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ChannelChat } from "./ChannelChat";
import type { Channel } from "./api";
import type { ChannelMessage } from "./messages.api";

vi.mock("@/modules/auth", () => ({
  useAuthSession: () => ({ user: { id: "owner" } }),
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const channels: Channel[] = [
  {
    id: "c1",
    groupId: "g1",
    groupTopicId: null,
    topicName: "Álgebra",
    name: "geral",
    description: "Conversa principal",
    createdBy: "owner",
    status: "active",
    createdAt: "2026-09-25T18:00:00Z",
    archivedAt: null,
  },
  {
    id: "c2",
    groupId: "g1",
    groupTopicId: null,
    topicName: null,
    name: "arquivo",
    description: null,
    createdBy: "owner",
    status: "archived",
    createdAt: "2026-09-25T18:01:00Z",
    archivedAt: "2026-09-25T19:00:00Z",
  },
];

function message(
  id: string,
  authorId: string,
  authorName: string,
  content: string | null,
  overrides: Partial<ChannelMessage> = {},
): ChannelMessage {
  return {
    id,
    channelId: "c1",
    authorId,
    authorName,
    replyToMessageId: null,
    replyPreview: null,
    content,
    createdAt: `2026-09-25T18:0${id === "m1" ? "1" : "2"}:00Z`,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("envia reply, edita e remove mensagem própria usando a API real do frontend", async () => {
  let messages: ChannelMessage[] = [
    message("m1", "owner", "Ana Silva", "Minha mensagem"),
    message("m2", "member", "Bruno Lima", "Olá"),
  ];
  const requests: Array<{ url: string; method: string; body?: unknown; headers: Headers }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, options: RequestInit = {}) => {
      const url = String(input);
      const method = options.method ?? "GET";
      const body =
        typeof options.body === "string" ? JSON.parse(options.body) : undefined;
      requests.push({
        url,
        method,
        body,
        headers: new Headers(options.headers),
      });

      if (url.endsWith("/groups/g1/channels")) {
        return Promise.resolve(json(channels));
      }
      if (url.includes("/channels/c1/messages")) {
        if (method === "POST") {
          const created = message("m3", "owner", "Ana Silva", body.content, {
            replyToMessageId: body.replyToMessageId,
            replyPreview: {
              id: "m2",
              authorName: "Bruno Lima",
              content: "Olá",
              deleted: false,
            },
            createdAt: "2026-09-25T18:03:00Z",
          });
          messages = [...messages, created];
          return Promise.resolve(json(created, 201));
        }
        if (method === "PATCH") {
          const saved = {
            ...messages.find((item) => item.id === "m1")!,
            content: body.content,
            editedAt: "2026-09-25T18:04:00Z",
          };
          messages = messages.map((item) => (item.id === "m1" ? saved : item));
          return Promise.resolve(json(saved));
        }
        if (method === "DELETE") {
          const removed = {
            ...messages.find((item) => item.id === "m1")!,
            content: null,
            deletedAt: "2026-09-25T18:05:00Z",
          };
          messages = messages.map((item) =>
            item.id === "m1" ? removed : item,
          );
          return Promise.resolve(json(removed));
        }
        return Promise.resolve(json(messages));
      }
      if (url.includes("/channels/c2/messages")) {
        return Promise.resolve(json([]));
      }
      return Promise.resolve(json([]));
    }),
  );

  render(<ChannelChat groupId="g1" />);

  const otherArticle = (await screen.findByText("Olá")).closest("article");
  expect(otherArticle).toBeTruthy();
  fireEvent.click(
    within(otherArticle as HTMLElement).getByRole("button", {
      name: "Responder",
    }),
  );

  await screen.findByText("Respondendo a Bruno Lima");
  const composer = screen.getByLabelText("Mensagem para #geral");
  fireEvent.change(composer, { target: { value: "Resposta real" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

  await screen.findByText("Resposta real");
  const post = requests.find(
    (request) =>
      request.method === "POST" && request.url.includes("/channels/c1/messages"),
  );
  expect(post?.body).toEqual({
    content: "Resposta real",
    replyToMessageId: "m2",
  });
  expect(post?.headers.get("X-NexoAula-CSRF")).toBe("1");
  expect(post?.headers.get("Content-Type")).toBe("application/json");

  const ownArticle = screen.getByText("Minha mensagem").closest("article");
  expect(ownArticle).toBeTruthy();
  fireEvent.click(
    within(ownArticle as HTMLElement).getByRole("button", { name: "Editar" }),
  );

  const editDialog = screen.getByRole("dialog");
  fireEvent.change(within(editDialog).getByLabelText("Conteúdo"), {
    target: { value: "Minha mensagem editada" },
  });
  fireEvent.click(
    within(editDialog).getByRole("button", { name: "Salvar edição" }),
  );
  await screen.findByText("Minha mensagem editada");

  const updatedArticle = screen
    .getByText("Minha mensagem editada")
    .closest("article");
  fireEvent.click(
    within(updatedArticle as HTMLElement).getByRole("button", {
      name: "Excluir",
    }),
  );
  const deleteDialog = screen.getByRole("dialog");
  fireEvent.click(
    within(deleteDialog).getByRole("button", { name: "Excluir mensagem" }),
  );
  await screen.findByText("Mensagem removida");

  expect(
    requests.some(
      (request) =>
        request.method === "PATCH" &&
        request.url.endsWith("/channels/c1/messages/m1"),
    ),
  ).toBe(true);
  expect(
    requests.some(
      (request) =>
        request.method === "DELETE" &&
        request.url.endsWith("/channels/c1/messages/m1"),
    ),
  ).toBe(true);
});

it("mantém canal arquivado legível e sem composer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/groups/g1/channels")) {
        return Promise.resolve(json(channels));
      }
      if (url.includes("/channels/c1/messages")) {
        return Promise.resolve(
          json([message("m1", "owner", "Ana Silva", "Histórico ativo")]),
        );
      }
      if (url.includes("/channels/c2/messages")) {
        return Promise.resolve(
          json([
            message("m9", "member", "Bruno Lima", "Conteúdo arquivado", {
              channelId: "c2",
            }),
          ]),
        );
      }
      return Promise.resolve(json([]));
    }),
  );

  render(<ChannelChat groupId="g1" />);
  await screen.findByText("Histórico ativo");

  fireEvent.click(screen.getByRole("button", { name: /arquivo.*Arquivado/i }));
  await screen.findByText("Conteúdo arquivado");
  expect(
    screen.getByText(
      "Este canal foi arquivado. O histórico continua disponível em modo somente leitura.",
    ),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Mensagem para #arquivo")).toBeNull();
  expect(screen.queryByRole("button", { name: "Responder" })).toBeNull();
});

it("ignora resposta atrasada do canal anterior após troca de canal", async () => {
  let resolveFirst: ((response: Response) => void) | undefined;
  const firstMessages = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });

  const activeChannels: Channel[] = [
    channels[0],
    { ...channels[1], status: "active", archivedAt: null },
  ];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/groups/g1/channels")) {
        return Promise.resolve(json(activeChannels));
      }
      if (url.includes("/channels/c1/messages")) return firstMessages;
      if (url.includes("/channels/c2/messages")) {
        return Promise.resolve(
          json([
            message("m8", "member", "Bruno Lima", "Mensagem do segundo canal", {
              channelId: "c2",
            }),
          ]),
        );
      }
      return Promise.resolve(json([]));
    }),
  );

  render(<ChannelChat groupId="g1" />);
  const secondChannel = await screen.findByRole("button", {
    name: /arquivo.*Canal ativo/i,
  });
  fireEvent.click(secondChannel);

  await screen.findByText("Mensagem do segundo canal");
  resolveFirst?.(
    json([message("m7", "owner", "Ana Silva", "Resposta atrasada do primeiro")]),
  );

  await waitFor(() => {
    expect(screen.queryByText("Resposta atrasada do primeiro")).toBeNull();
    expect(screen.getByText("Mensagem do segundo canal")).toBeTruthy();
  });
});

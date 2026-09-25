import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GroupDetail } from "./GroupDetail";
import { ChannelManager } from "./ChannelManager";
import type { Channel } from "./api";

vi.mock("@/modules/auth", () => ({ useAuthSession: () => ({ user: { id:"owner" } }) }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type":"application/json" } });
afterEach(() => vi.unstubAllGlobals());

it("moderador cria, renomeia e arquiva; lista acompanha cada alteração", async () => {
  let channel: Channel | undefined;
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.endsWith("/participation")) return Promise.resolve(json({status:"active",role:"moderator",canManage:true,memberCount:2}));
    if (url.endsWith("/channels/c1/archive")) {
      channel = {...channel!,status:"archived",archivedAt:new Date().toISOString()};
      return Promise.resolve(json(channel));
    }
    if (url.endsWith("/channels/c1")) {
      channel = {...channel!,...JSON.parse(String(options.body))};
      return Promise.resolve(json(channel));
    }
    if (url.endsWith("/channels")) {
      if (options.method === "POST") {
        const body = JSON.parse(String(options.body));
        expect(body.groupTopicId).toBe("topic-1");
        channel = {id:"c1",groupId:"g1",createdBy:"owner",status:"active",createdAt:new Date().toISOString(),archivedAt:null,topicName:"Álgebra",...body};
        return Promise.resolve(json(channel,201));
      }
      return Promise.resolve(json(channel ? [channel] : []));
    }
    if (url.includes("/topics")) return Promise.resolve(json([{id:"topic-1",groupId:"g1",customTitle:"Álgebra",topicName:"Álgebra",subjectTopicId:null}]));
    if (url.endsWith("/groups/g1")) return Promise.resolve(json({id:"g1",name:"Grupo",status:"active",visibility:"public",joinPolicy:"open"}));
    return Promise.resolve(json([]));
  }));
  render(<GroupDetail groupId="g1" />);
  const manager = (await screen.findByRole("heading", {name:"Gerenciar canais"})).closest("section")!;
  fireEvent.click(within(manager).getByRole("button",{name:"+ Novo Canal"}));
  fireEvent.change(within(manager).getByLabelText(/Nome do canal/),{target:{value:"Dúvidas"}});
  await within(manager).findByRole("option",{name:"Álgebra"});
  fireEvent.change(within(manager).getByLabelText(/Assunto do grupo/),{target:{value:"topic-1"}});
  fireEvent.click(within(manager).getByRole("button",{name:"Salvar"}));
  await screen.findByText("Canal criado com sucesso.");
  const list = (await screen.findByRole("heading",{name:"Canais por assunto"})).closest("section")!;
  await within(list).findByText("Assunto: Álgebra");
  fireEvent.click(screen.getByRole("button",{name:"Renomear"}));
  fireEvent.change(screen.getByLabelText(/Nome do canal/),{target:{value:"Revisão"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
  await screen.findByText("Canal atualizado com sucesso.");
  const updated = (await screen.findByRole("heading",{name:"Canais por assunto"})).closest("section")!;
  await within(updated).findByRole("heading",{name:/Revisão/});
  fireEvent.click(screen.getByRole("button",{name:"Arquivar"}));
  await screen.findByText("Canal arquivado.");
  const archived = (await screen.findByRole("heading",{name:"Canais por assunto"})).closest("section")!;
  expect(within(archived).getByText("Arquivado")).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Renomear"})).toBeNull();
});

it("preserva entrada e mostra erro de API sem anunciar sucesso", async () => {
  const updated=vi.fn();
  vi.stubGlobal("fetch",vi.fn((url:string, options:RequestInit) => Promise.resolve(
    options.method === "POST" ? json({detail:"Já existe um canal com este nome no grupo."},409) : json([]))));
  render(<ChannelManager groupId="g1" onUpdated={updated} />);
  fireEvent.click(await screen.findByRole("button",{name:"+ Novo Canal"}));
  fireEvent.change(screen.getByLabelText(/Nome do canal/),{target:{value:"Duplicado"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
  await screen.findByText("Já existe um canal com este nome no grupo.");
  expect((screen.getByLabelText(/Nome do canal/) as HTMLInputElement).value).toBe("Duplicado");
  expect(updated).not.toHaveBeenCalled();
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GroupMeetings } from "./GroupMeetings";
import type { Meeting } from "./meetings.api";

vi.mock("@/modules/auth", () => ({ useAuthSession: () => ({ user: { id: "owner" } }) }));
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type":"application/json" } });
function meeting(status: Meeting['status'], future = false): Meeting {
  return { id:"m1", groupId:"g1", organizerId:"owner", channelId:null, title:"Encontro real", description:null,
    modality:"online", location:null, externalUrl:"https://example.org/", status,
    startsAt: new Date(Date.now() + (future ? 3_600_000 : -7_200_000)).toISOString(),
    endsAt: new Date(Date.now() + (future ? 7_200_000 : -3_600_000)).toISOString(),
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), topicIds:[], confirmedCount:1, participantStatus:"confirmed" };
}
it("permite registrar presença após encerramento e mostra o estado persistido", async () => {
  let value = meeting("completed");
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.endsWith("/topics")) return Promise.resolve(json([]));
    if (url.endsWith("/participants/me")) {
      expect(JSON.parse(String(options.body))).toEqual({ status:"attended" });
      value = { ...value, participantStatus:"attended" };
      return Promise.resolve(json({ status:"attended" }));
    }
    return Promise.resolve(json([value]));
  }));
  render(<GroupMeetings groupId="g1" canManage={false} />);
  fireEvent.click(await screen.findByRole("button", { name:"Registrar minha presença" }));
  await screen.findByText("Sua participação: Presença registrada");
  expect(screen.queryByRole("button", { name:"Confirmar" })).toBeNull();
  expect(screen.queryByRole("button", { name:"Registrar resultado" })).toBeNull();
});
it.each(["scheduled", "cancelled"] as const)("não oferece presença prematura ou cancelada: %s", async status => {
  const value = meeting(status, true);
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(json(url.endsWith("/topics") ? [] : [value]))));
  render(<GroupMeetings groupId="g1" canManage={false} />);
  await screen.findByRole("heading", { name:"Encontro real" });
  expect(screen.queryByRole("button", { name:"Registrar minha presença" })).toBeNull();
});
it("mostra falha da API dentro do diálogo de edição e preserva os campos", async () => {
  const value = meeting("scheduled", true);
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => Promise.resolve(
    options.method === "PATCH" ? json({detail:"Encontro foi cancelado por outra sessão."},409)
      : json(url.endsWith("/topics") ? [] : [value]))));
  render(<GroupMeetings groupId="g1" canManage />);
  fireEvent.click(await screen.findByRole("button", { name:"Editar" }));
  const modal = screen.getByRole("dialog");
  fireEvent.change(within(modal).getByLabelText("Título"), {target:{value:"Novo título"}});
  fireEvent.click(within(modal).getByRole("button", {name:"Salvar alterações"}));
  await within(modal).findByText("Encontro foi cancelado por outra sessão.");
  expect((within(modal).getByLabelText("Título") as HTMLInputElement).value).toBe("Novo título");
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canRecordAttendance,
  fetchMyAdjustments,
  fetchMyAttendance,
  fetchMyProgress,
  markAdjustmentSeen,
  recordMyAttendance,
  removeMyAttendance,
  updateMyProgress,
} from "./attendance";
import type { LessonOccurrence } from "./types";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function mockServer(handler: (url: string, options: RequestInit) => Response | Promise<Response>) {
  return vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => handler(url, options)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("attendance and progress api client", () => {
  it("valida canRecordAttendance apenas para aulas realizadas encerradas", () => {
    const occ: LessonOccurrence = {
      id: "occ-1",
      plannedLessonId: "lesson-1",
      title: "Cálculo I",
      date: "2026-09-08",
      displayDate: "08/09/2026",
      time: "14:00",
      status: "held",
      actualStartsAt: "2026-09-08T14:00:00Z",
      actualEndsAt: "2026-09-08T16:00:00Z",
    };

    expect(canRecordAttendance(occ, "2026-09-08T17:00:00Z")).toBe(true);
    expect(canRecordAttendance(occ, "2026-09-08T15:00:00Z")).toBe(false); // em andamento
    expect(canRecordAttendance({ ...occ, status: "cancelled" }, "2026-09-08T17:00:00Z")).toBe(false);
    expect(canRecordAttendance({ ...occ, status: "postponed" }, "2026-09-08T17:00:00Z")).toBe(false);
  });

  it("chama GET /api/v1/me/attendance com e sem groupId", async () => {
    const calls: string[] = [];
    mockServer((url) => {
      calls.push(url);
      return json([{ lessonOccurrenceId: "occ-1", groupId: "group-1", status: "present", updatedAt: new Date().toISOString() }]);
    });

    const resAll = await fetchMyAttendance();
    expect(resAll).toHaveLength(1);
    expect(calls[0]).toContain("/api/v1/me/attendance");

    const resGroup = await fetchMyAttendance("group-1");
    expect(resGroup).toHaveLength(1);
    expect(calls[1]).toContain("/api/v1/me/attendance?groupId=group-1");
  });

  it("registra presença com POST e cabeçalho CSRF obrigatório", async () => {
    let capturedMethod = "";
    let capturedHeaders: Headers | null = null;
    let capturedBody: unknown = null;

    mockServer((url, options) => {
      capturedMethod = options.method || "GET";
      capturedHeaders = new Headers(options.headers);
      capturedBody = JSON.parse(String(options.body));
      return json(
        {
          lessonOccurrenceId: "occ-1",
          groupId: "group-1",
          status: "present",
          notes: "Aula excelente",
          updatedAt: new Date().toISOString(),
        },
        201,
      );
    });

    const record = await recordMyAttendance("occ-1", "present", "Aula excelente");
    expect(capturedMethod).toBe("POST");
    expect((capturedHeaders as any)?.get("X-NexoAula-CSRF")).toBe("1");
    expect(capturedBody).toEqual({
      lessonOccurrenceId: "occ-1",
      status: "present",
      notes: "Aula excelente",
    });
    expect(record.status).toBe("present");
  });

  it("remove presença com DELETE e cabeçalho CSRF", async () => {
    let capturedMethod = "";
    let capturedHeaders: Headers | null = null;

    mockServer((url, options) => {
      capturedMethod = options.method || "GET";
      capturedHeaders = new Headers(options.headers);
      return new Response(null, { status: 204 });
    });

    await removeMyAttendance("occ-1");
    expect(capturedMethod).toBe("DELETE");
    expect((capturedHeaders as any)?.get("X-NexoAula-CSRF")).toBe("1");
  });

  it("atualiza progresso de tópico com PUT e CSRF", async () => {
    let capturedMethod = "";
    let capturedBody: unknown = null;

    mockServer((url, options) => {
      capturedMethod = options.method || "GET";
      capturedBody = JSON.parse(String(options.body));
      return json({
        groupTopicId: "top-1",
        groupId: "group-1",
        status: "mastered",
        notes: null,
        updatedAt: new Date().toISOString(),
      });
    });

    const updated = await updateMyProgress("top-1", "mastered");
    expect(capturedMethod).toBe("PUT");
    expect(capturedBody).toEqual({ status: "mastered", notes: null });
    expect(updated.status).toBe("mastered");
  });

  it("consulta avisos de ajuste e marca como visto com PATCH", async () => {
    let patchUrl = "";
    let capturedHeaders: Headers | null = null;

    mockServer((url, options) => {
      if (options.method === "PATCH") {
        patchUrl = url;
        capturedHeaders = new Headers(options.headers);
        return json({
          id: "adj-1",
          userId: "user-1",
          sourceOccurrenceId: "occ-old",
          targetOccurrenceId: "occ-new",
          targetStatus: "held",
          outcome: "transferred",
          previousStatus: "present",
          createdAt: new Date().toISOString(),
          noticeSeenAt: new Date().toISOString(),
        });
      }
      return json([
        {
          id: "adj-1",
          userId: "user-1",
          sourceOccurrenceId: "occ-old",
          targetOccurrenceId: "occ-new",
          targetStatus: "held",
          outcome: "transferred",
          previousStatus: "present",
          createdAt: new Date().toISOString(),
          noticeSeenAt: null,
        },
      ]);
    });

    const unread = await fetchMyAdjustments(true);
    expect(unread).toHaveLength(1);
    expect(unread[0].noticeSeenAt).toBeNull();

    const marked = await markAdjustmentSeen("adj-1");
    expect(patchUrl).toContain("/api/v1/me/attendance-adjustments/adj-1/seen");
    expect((capturedHeaders as any)?.get("X-NexoAula-CSRF")).toBe("1");
    expect(marked.noticeSeenAt).not.toBeNull();
  });
});

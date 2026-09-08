import { describe, expect, it } from "vitest";
import { canRecordAttendance } from "./attendance";
import { disciplinesMap, academicReferenceTime } from "@/mocks/academic/academicCatalog";

describe("frequência pessoal", () => {
  const occurrence = disciplinesMap["modelagem-simulacao"].occurrences.find((item) => item.status === "held")!;
  it("aceita aula realizada encerrada", () => {
    expect(canRecordAttendance(occurrence, academicReferenceTime)).toBe(true);
  });
  it.each(["scheduled", "cancelled", "postponed"] as const)("recusa %s", (status) => {
    expect(canRecordAttendance({ ...occurrence, status }, academicReferenceTime)).toBe(false);
  });
  it("recusa aula em andamento, futura ou sem fim real", () => {
    expect(canRecordAttendance({ ...occurrence, actualEndsAt: undefined }, academicReferenceTime)).toBe(false);
    expect(canRecordAttendance({ ...occurrence, actualEndsAt: "2026-09-09T18:00:00Z" }, academicReferenceTime)).toBe(false);
    expect(canRecordAttendance({ ...occurrence, actualStartsAt: "2026-09-09T12:00:00Z" }, academicReferenceTime)).toBe(false);
  });
});

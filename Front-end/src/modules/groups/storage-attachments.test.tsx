import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/modules/auth", () => ({ useAuthSession: () => ({ user: { id: "owner" } }) }));
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AcademicProfile } from "@/modules/academic/components/AcademicProfile";
import { GroupSchedule } from "./GroupSchedule";
import type { TeachingPlan } from "./schedule";
import type { Profile } from "./api";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Avatar do Usuário e Anexo do Plano de Ensino com Storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AcademicProfile - Avatar", () => {
    it("exibe inicial como fallback e permite adicionar foto com sucesso", async () => {
      let currentProfile: Profile = {
        userId: "u1",
        displayName: "Beatriz Santos",
        institutionId: null,
        courseId: null,
        bio: null,
        avatarFileId: null,
        avatarUrl: null,
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.includes("/api/v1/academic/profile/avatar")) {
          if (method === "POST") {
            currentProfile = {
              ...currentProfile,
              avatarFileId: "file-avatar-1",
              avatarUrl: "/api/v1/users/u1/avatar",
            };
            return json(currentProfile);
          }
          if (method === "DELETE") {
            currentProfile = {
              ...currentProfile,
              avatarFileId: null,
              avatarUrl: null,
            };
            return json(currentProfile);
          }
        }

        if (url.includes("/api/v1/academic/profile")) {
          return json(currentProfile);
        }
        if (url.includes("/api/v1/academic/institutions") || url.includes("/api/v1/academic/courses")) {
          return json([]);
        }

        return json({});
      });

      render(<AcademicProfile />);

      // Fallback initial
      await screen.findByText("Beatriz Santos");
      expect(screen.getByText("B")).toBeDefined();
      expect(screen.getByText("Adicionar foto")).toBeDefined();

      // Upload valid PNG
      const fileInput = screen.getByTestId("avatar-input") as HTMLInputElement;
      const validPng = new File(["fake png content"], "foto.png", { type: "image/png" });
      fireEvent.change(fileInput, { target: { files: [validPng] } });

      await waitFor(() => {
        expect(screen.getByText("Trocar foto")).toBeDefined();
        expect(screen.getByText("Remover foto")).toBeDefined();
      });
      const img = screen.getByRole("img", { name: "Foto de Beatriz Santos" });
      expect(img.getAttribute("src")).toBe("/api/v1/users/u1/avatar");

      // Remover foto restaura avatar padrão
      fireEvent.click(screen.getByText("Remover foto"));
      await waitFor(() => {
        expect(screen.getByText("Adicionar foto")).toBeDefined();
        expect(screen.getByText("B")).toBeDefined();
      });
    });

    it("rejeita arquivo com mais de 5 MB e tipo inválido sem apagar foto existente", async () => {
      const currentProfile = {
        userId: "u1",
        displayName: "Carlos Lima",
        institutionId: null,
        courseId: null,
        bio: null,
        avatarFileId: "file-initial",
        avatarUrl: "/api/v1/users/u1/avatar",
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/api/v1/academic/profile")) {
          return json(currentProfile);
        }
        return json([]);
      });

      render(<AcademicProfile />);
      await screen.findByText("Carlos Lima");

      const fileInput = screen.getByTestId("avatar-input") as HTMLInputElement;

      // 1. Oversized file (> 5 MB)
      const oversizedBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "image/jpeg" });
      const oversizedFile = new File([oversizedBlob], "large.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

      await screen.findByText("O tamanho da foto excede o limite de 5 MB.");
      // Foto anterior continua preservada
      expect(screen.getByRole("img", { name: "Foto de Carlos Lima" })).toBeDefined();

      // 2. Invalid MIME type (text)
      const textFile = new File(["document text"], "doc.txt", { type: "text/plain" });
      fireEvent.change(fileInput, { target: { files: [textFile] } });

      await screen.findByText("Formato de imagem inválido. Formatos suportados: JPEG e PNG.");
      // Foto anterior continua preservada
      expect(screen.getByRole("img", { name: "Foto de Carlos Lima" })).toBeDefined();
    });
  });

  describe("GroupSchedule - Anexo do Plano de Ensino", () => {
    it("renderiza aviso complementar e permite ao organizador anexar e remover PDF", async () => {
      let plans: TeachingPlan[] = [
        {
          id: "plan-1",
          groupId: "group-10",
          version: 1,
          status: "published",
          publishedAt: "2026-09-01T10:00:00Z",
          lessons: [],
          sourceFileId: null as string | null,
          sourceFileName: null as string | null,
          sourceFileSize: null as number | null,
        },
      ];

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.includes("/api/v1/groups/group-10/plans/plan-1/attachment")) {
          if (method === "POST") {
            plans = [
              {
                ...plans[0],
                sourceFileId: "file-pdf-1",
                sourceFileName: "ementa_calculo.pdf",
                sourceFileSize: 2 * 1024 * 1024,
              },
            ];
            return json(plans[0]);
          }
          if (method === "DELETE") {
            plans = [
              {
                ...plans[0],
                sourceFileId: null,
                sourceFileName: null,
                sourceFileSize: null,
              },
            ];
            return json(plans[0]);
          }
        }

        if (url.includes("/api/v1/groups/group-10/plans")) {
          return json(plans);
        }
        if (url.includes("/occurrences") || url.includes("/topics") || url.includes("/attendance") || url.includes("/progress") || url.includes("/adjustments") || url.includes("/meetings") || url.includes("/planning-corrections")) {
          return json([]);
        }

        return json({});
      });

      render(<GroupSchedule groupId="group-10" canManage={true} />);

      // Aviso de fonte complementar obrigatório
      await screen.findByText(/Aviso: Este anexo serve como fonte complementar de consulta/);
      expect(screen.getByText("Nenhum arquivo PDF anexado a este plano de ensino.")).toBeDefined();
      expect(screen.getByText("Anexar PDF (até 10 MB)")).toBeDefined();

      // Attach valid PDF
      const input = screen.getByTestId("plan-attachment-input") as HTMLInputElement;
      const pdfFile = new File(["%PDF-1.4 sample"], "ementa_calculo.pdf", { type: "application/pdf" });
      fireEvent.change(input, { target: { files: [pdfFile] } });

      await waitFor(() => {
        expect(screen.getByText("ementa_calculo.pdf")).toBeDefined();
        expect(screen.getByText("(2.00 MB)")).toBeDefined();
        expect(screen.getByText("Baixar PDF")).toBeDefined();
        expect(screen.getByText("Substituir PDF")).toBeDefined();
        expect(screen.getByText("Remover anexo")).toBeDefined();
      });

      // Remove attachment
      fireEvent.click(screen.getByText("Remover anexo"));
      await waitFor(() => {
        expect(screen.getByText("Nenhum arquivo PDF anexado a este plano de ensino.")).toBeDefined();
      });
    });

    it("valida limite de 10 MB e tipo PDF na interface", async () => {
      const plans: TeachingPlan[] = [
        {
          id: "plan-1",
          groupId: "group-10",
          version: 1,
          status: "published",
          publishedAt: "2026-09-01T10:00:00Z",
          lessons: [],
          sourceFileId: null,
          sourceFileName: null,
          sourceFileSize: null,
        },
      ];

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/api/v1/groups/group-10/plans")) {
          return json(plans);
        }
        return json([]);
      });

      render(<GroupSchedule groupId="group-10" canManage={true} />);
      await screen.findByText(/Aviso: Este anexo serve como fonte complementar/);

      const input = screen.getByTestId("plan-attachment-input") as HTMLInputElement;

      // 1. Exceeds 10 MB
      const bigBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "application/pdf" });
      const bigFile = new File([bigBlob], "big.pdf", { type: "application/pdf" });
      fireEvent.change(input, { target: { files: [bigFile] } });

      await screen.findByText("O anexo excede o limite permitido de 10 MB.");

      // 2. Non-PDF format
      const exeFile = new File(["malware"], "app.exe", { type: "application/x-msdownload" });
      fireEvent.change(input, { target: { files: [exeFile] } });

      await screen.findByText("Formato de arquivo inválido. O plano exige um arquivo PDF.");
    });
  });
});

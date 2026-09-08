import { afterEach, describe, expect, it } from "vitest";

import { getApiBaseUrl } from "./env";

const originalApiBaseUrl = process.env.API_BASE_URL;

afterEach(() => {
  if (originalApiBaseUrl === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = originalApiBaseUrl;
});

describe("getApiBaseUrl", () => {
  it("usa a origem local padrão quando a variável não está configurada", () => {
    delete process.env.API_BASE_URL;
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("normaliza uma origem HTTP(S) configurada", () => {
    process.env.API_BASE_URL = "https://api.nexoaula.example/";
    expect(getApiBaseUrl()).toBe("https://api.nexoaula.example");
  });

  it.each([
    "not-a-url",
    "ftp://api.nexoaula.example",
    "https://user:secret@api.nexoaula.example",
    "https://api.nexoaula.example/base",
    "https://api.nexoaula.example?debug=1",
  ])("rejeita uma origem inválida ou insegura: %s", (value) => {
    process.env.API_BASE_URL = value;
    expect(() => getApiBaseUrl()).toThrow("API_BASE_URL");
  });
});

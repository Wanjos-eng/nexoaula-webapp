import { apiClient, type ApiResponse } from "@/lib/api";

/**
 * Payload para criação de nova conta de usuário.
 */
export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

/**
 * Serviço de Autenticação
 * Encapsula as chamadas de integração da jornada de usuário não-autenticado.
 */
export const authService = {
  /**
   * Envia os dados de cadastro para a API.
   * Em caso de sucesso, o backend retorna 201 Created (sem payload ou com dados básicos).
   *
   * @throws {ApiError} 409 caso o email já esteja em uso
   * @throws {ApiError} 422 caso os dados sejam rejeitados pelo servidor
   * @throws {NetworkError} caso não consiga acessar o servidor
   * @throws {TimeoutError} caso a requisição demore muito
   */
  async register(data: RegisterRequest, signal?: AbortSignal): Promise<ApiResponse<RegisterResponse>> {
    return apiClient.post("/v1/auth/register", {
      body: data,
      signal,
    });
  },
};

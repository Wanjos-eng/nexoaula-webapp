/**
 * Ponto de entrada público do módulo de integração com a API.
 *
 * @example
 * ```ts
 * import { apiClient, ApiError } from "@/lib/api";
 *
 * try {
 *   const { data } = await apiClient.get<User>("/v1/auth/me");
 * } catch (error) {
 *   if (error instanceof ApiError && error.status === 401) {
 *     redirect("/login");
 *   }
 * }
 * ```
 */

export { apiClient, get, post, put, patch, del } from "./client";
export type { RequestOptions, ApiResponse } from "./client";
export { ApiError, NetworkError, ParseError, RequestAbortedError, TimeoutError } from "./errors";

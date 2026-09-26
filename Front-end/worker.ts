import vinext from "vinext/server/fetch-handler";

export * from "vinext/server/fetch-handler";

type WorkerEnv = {
  API_BASE_URL?: string;
};

export default {
  fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const base = env.API_BASE_URL ?? "https://nexoaula-api.onrender.com";
      const target = new URL(base);
      target.pathname = url.pathname;
      target.search = url.search;
      return fetch(new Request(target, request));
    }

    return vinext.fetch(request, env, ctx);
  },
};

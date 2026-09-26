import vinext from "vinext/server/fetch-handler";

export * from "vinext/server/fetch-handler";

type WorkerEnv = {
  API_BASE_URL?: string;
  API: { fetch(request: Request): Promise<Response> };
};

export default {
  fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (env.API_BASE_URL) {
        const target = new URL(env.API_BASE_URL);
        target.pathname = url.pathname;
        target.search = url.search;
        return fetch(new Request(target, request));
      }
      url.protocol = "https:";
      url.hostname = "nexoaula-api.nexoaula-wanjos.workers.dev";
      url.port = "";
      return env.API.fetch(new Request(url, request));
    }
    return vinext.fetch(request, env, ctx);
  },
};

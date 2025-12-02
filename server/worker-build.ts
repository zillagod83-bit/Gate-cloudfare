import { handleApiRoute } from "./api-handler.js";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      try {
        const body = request.method !== "GET"
          ? await request.json().catch(() => ({}))
          : {};

        let statusCode = 200;
        let responseBody: any = {};
        const responseHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        const mockRes = {
          status: (code: number) => { statusCode = code; return mockRes; },
          json: (data: any) => { responseBody = data; return mockRes; },
          setHeader: (k: string, v: string) => { responseHeaders[k] = v; return mockRes; },
          end: () => {},
        };

        await handleApiRoute(
          { method: request.method, body, headers: request.headers },
          mockRes,
          pathname,
          env
        );

        return new Response(JSON.stringify(responseBody), {
          status: statusCode,
          headers: responseHeaders,
        });
      } catch (error: any) {
        return new Response(
          JSON.stringify({ error: error.message || "Server Error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(null, { status: 404 });
  },
};

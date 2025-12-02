import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";

// Cloudflare Workers entry point
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith("/api")) {
      try {
        // Mock Express request/response for compatibility
        const reqBody = request.method !== "GET" && request.method !== "HEAD" 
          ? await request.json().catch(() => ({}))
          : {};

        // Create Express-compatible request object
        const mockReq = {
          method: request.method,
          path: path,
          url: url.toString(),
          headers: Object.fromEntries(request.headers),
          body: reqBody,
          query: Object.fromEntries(url.searchParams),
          get: (header: string) => request.headers.get(header),
        };

        // Create Express-compatible response object
        let statusCode = 200;
        let responseBody: any = {};
        const responseHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        const mockRes = {
          status: (code: number) => {
            statusCode = code;
            return mockRes;
          },
          json: (data: any) => {
            responseBody = data;
            return mockRes;
          },
          setHeader: (key: string, value: string) => {
            responseHeaders[key] = value;
            return mockRes;
          },
          end: () => {},
        };

        // Import and execute the route handler
        const { handleApiRoute } = await import("./api-handler.ts");
        await handleApiRoute(mockReq as any, mockRes as any, path, env);

        return new Response(JSON.stringify(responseBody), {
          status: statusCode,
          headers: responseHeaders,
        });
      } catch (error: any) {
        console.error("[API Error]", error);
        return new Response(
          JSON.stringify({
            error: error.message || "Internal Server Error",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // Static files (frontend)
    const staticResponse = await serveStatic(path);
    if (staticResponse) {
      return staticResponse;
    }

    // Default to index.html for SPA
    return new Response(
      await import("./static").then(m => m.getIndexHtml()),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};

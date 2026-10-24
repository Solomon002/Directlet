import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "./app";

// The entry point when the API runs as a Vercel function. The website and the
// API share one address and the API lives under /api, so that prefix is removed
// before Express sees the request. Locally the API starts from index.ts instead.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url) {
    req.url = req.url.replace(/^\/api(?=\/|\?|$)/, "") || "/";
  }
  app(req as never, res as never);
}

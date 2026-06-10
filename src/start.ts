import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, handlerType, request }) => {
    if (handlerType === "serverFn" || new URL(request.url).pathname.startsWith("/_serverFn/")) {
      return next();
    }

    try {
      return await next();
    } catch (error) {
      if (error != null && typeof error === "object" && "statusCode" in error) {
        throw error;
      }
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));

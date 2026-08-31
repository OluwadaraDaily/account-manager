import express from "express";
import { appConfig } from "./config.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", appConfig.frontendOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "DELETE, GET, PATCH, POST, PUT, OPTIONS");
    response.setHeader("Vary", "Origin");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json({ limit: "64kb" }));

  return app;
}

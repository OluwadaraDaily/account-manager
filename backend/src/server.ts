import express from "express";
import type { HealthResponse } from "@account-manager/shared";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5174";

app.disable("x-powered-by");

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Vary", "Origin");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_request, response) => {
  const body: HealthResponse = {
    service: "account-manager-backend",
    status: "ok",
  };

  response.json(body);
});

app.listen(port, () => {
  console.log(`Account Manager backend listening on http://localhost:${port}`);
});

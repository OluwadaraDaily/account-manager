import { Router } from "express";
import type { HealthResponse } from "@account-manager/shared";

export function createHealthRouter() {
  const router = Router();

  router.get("/health", (_request, response) => {
    const body: HealthResponse = {
      service: "account-manager-backend",
      status: "ok",
    };

    response.json(body);
  });

  return router;
}

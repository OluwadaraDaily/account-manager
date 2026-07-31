import type { Response } from "express";
import { appConfig } from "../config.js";

export function redirectToFrontend(response: Response, status: "connected" | "error") {
  const target = new URL(appConfig.frontendOrigin);
  target.searchParams.set("gmail", status);
  response.redirect(target.toString());
}

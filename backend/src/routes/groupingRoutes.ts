import { Router } from "express";
import { appConfig } from "../config.js";
import type { GroupingStore } from "../db/repositories/groupingStore.js";
import { parseCookies } from "../http/cookies.js";
import { validateBody, validateQuery } from "../middleware/validation.js";
import {
  assignTransactionGroupBodySchema,
  createTransactionGroupBodySchema,
  groupingBankQuerySchema,
  renameTransactionGroupBodySchema,
} from "../validators/groupingValidators.js";

type GroupingRouterDependencies = {
  groupingStorePromise: Promise<GroupingStore>;
  sessionStorePromise: Promise<{ get(sessionId: string): Promise<{ googleSubject: string } | null> }>;
};

function toGroupingResponse(group: Awaited<ReturnType<GroupingStore["create"]>>) {
  const { googleSubject: _googleSubject, bankId: _bankId, ...safeGroup } = group;
  return safeGroup;
}

export function createGroupingRouter({
  groupingStorePromise,
  sessionStorePromise,
}: GroupingRouterDependencies) {
  const router = Router();

  async function getAccount(request: { headers: { cookie?: string } }) {
    const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
    return sessionId ? (await sessionStorePromise).get(sessionId) : null;
  }

  router.get("/groups", validateQuery(groupingBankQuerySchema), async (request, response) => {
    const account = await getAccount(request);
    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }
    const groups = await (await groupingStorePromise).list(
      account.googleSubject,
      response.locals.validatedQuery.bankId,
    );
    response.json({ groups: groups.map(toGroupingResponse) });
  });

  router.post("/groups", validateBody(createTransactionGroupBodySchema), async (request, response) => {
    const account = await getAccount(request);
    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }
    try {
      const group = await (await groupingStorePromise).create({
        googleSubject: account.googleSubject,
        ...response.locals.validatedBody,
      });
      response.status(201).json({ group: toGroupingResponse(group) });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        response.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  router.patch("/groups/:groupId", validateBody(renameTransactionGroupBodySchema), async (request, response) => {
    const account = await getAccount(request);
    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }
    const group = await (await groupingStorePromise).rename(
      account.googleSubject,
      response.locals.validatedBody.bankId,
      request.params.groupId as string,
      response.locals.validatedBody.name,
    );
    if (!group) {
      response.status(404).json({ error: "Group was not found." });
      return;
    }
    response.json({ group: toGroupingResponse(group) });
  });

  router.delete("/groups/:groupId", validateQuery(groupingBankQuerySchema), async (request, response) => {
    const account = await getAccount(request);
    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }
    const deleted = await (await groupingStorePromise).delete(
      account.googleSubject,
      response.locals.validatedQuery.bankId,
      request.params.groupId as string,
    );
    if (!deleted) {
      response.status(404).json({ error: "Group was not found." });
      return;
    }
    response.sendStatus(204);
  });

  router.put(
    "/groups/:groupId/transactions/:transactionId",
    validateBody(assignTransactionGroupBodySchema),
    async (request, response) => {
      const account = await getAccount(request);
      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }
      const membership = await (await groupingStorePromise).assign(
        account.googleSubject,
        response.locals.validatedBody.bankId,
        request.params.groupId as string,
        request.params.transactionId as string,
      );
      if (!membership) {
        response.status(404).json({ error: "Group or transaction was not found." });
        return;
      }
      response.json({ membership });
    },
  );

  router.delete(
    "/groups/transactions/:transactionId",
    validateQuery(groupingBankQuerySchema),
    async (request, response) => {
      const account = await getAccount(request);
      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }
      const removed = await (await groupingStorePromise).unassign(
        account.googleSubject,
        response.locals.validatedQuery.bankId,
        request.params.transactionId as string,
      );
      if (!removed) {
        response.status(404).json({ error: "Transaction group membership was not found." });
        return;
      }
      response.sendStatus(204);
    },
  );

  router.get("/groups/memberships", validateQuery(groupingBankQuerySchema), async (request, response) => {
    const account = await getAccount(request);
    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }
    const memberships = await (await groupingStorePromise).listMemberships(
      account.googleSubject,
      response.locals.validatedQuery.bankId,
    );
    response.json({ memberships });
  });

  return router;
}

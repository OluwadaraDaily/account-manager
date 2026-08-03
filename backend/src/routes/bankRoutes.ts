import { Router } from "express";
import type { BankDirectoryStore } from "../db/repositories/bankDirectoryStore.js";

type BankRouterDependencies = {
  bankDirectoryStorePromise: Promise<BankDirectoryStore>;
};

export function createBankRouter({ bankDirectoryStorePromise }: BankRouterDependencies) {
  const router = Router();

  router.get("/banks/:bankId", async (request, response) => {
    const bankDirectoryStore = await bankDirectoryStorePromise;
    const bank = await bankDirectoryStore.get(request.params.bankId);

    if (!bank) {
      response.status(404).json({ error: "Bank was not found." });
      return;
    }

    response.json({
      bank: {
        id: bank.id,
        displayName: bank.displayName,
        transactionNotificationSenderEmail: bank.transactionNotificationSenderEmail,
      },
    });
  });

  return router;
}

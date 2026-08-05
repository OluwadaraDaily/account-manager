import { Router } from "express";
import type { BankDirectoryStore } from "../db/repositories/bankDirectoryStore.js";

type BankRouterDependencies = {
  bankDirectoryStorePromise: Promise<BankDirectoryStore>;
};

export function toBankSelectionMetadata(banks: Awaited<ReturnType<BankDirectoryStore["list"]>>) {
  return banks
    .filter((bank) => bank.status !== "inactive")
    .map((bank) => ({
      id: bank.id,
      displayName: bank.displayName,
      status: bank.status,
      verificationStatus: bank.verificationStatus,
    }));
}

export function createBankRouter({ bankDirectoryStorePromise }: BankRouterDependencies) {
  const router = Router();

  router.get("/banks", async (_request, response) => {
    const bankDirectoryStore = await bankDirectoryStorePromise;
    const banks = toBankSelectionMetadata(await bankDirectoryStore.list());

    response.json({ banks });
  });

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

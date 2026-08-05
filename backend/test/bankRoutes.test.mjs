import assert from "node:assert/strict";
import test from "node:test";

const [{ toBankSelectionMetadata }] = await Promise.all([import("../dist/routes/bankRoutes.js")]);

test("lists active banks using safe selection metadata", () => {
  const banks = toBankSelectionMetadata([
    {
      id: "union-bank",
      displayName: "Union Bank",
      status: "active",
      verificationStatus: "verified",
      transactionNotificationSenderEmail: "alerts@unionbankng.com",
      officialDomains: ["unionbankng.com"],
      searchTerms: ["union bank"],
    },
    {
      id: "inactive-bank",
      displayName: "Inactive Bank",
      status: "inactive",
      verificationStatus: "needs-review",
      transactionNotificationSenderEmail: null,
      officialDomains: [],
      searchTerms: [],
    },
  ]);

  assert.deepEqual(banks, [
    {
      id: "union-bank",
      displayName: "Union Bank",
      status: "active",
      verificationStatus: "verified",
    },
  ]);
});

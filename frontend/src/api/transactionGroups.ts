import { apiClient } from "./client";
import type {
  TransactionGroupResponse,
  TransactionGroupMembershipResponse,
} from "@account-manager/shared";

export type TransactionGroup = TransactionGroupResponse;
export type TransactionGroupMembership = TransactionGroupMembershipResponse;

export async function listTransactionGroups(bankId: string): Promise<TransactionGroup[]> {
  const response = await apiClient.get<{ groups: TransactionGroup[] }>("/groups", {
    params: { bankId },
  });
  return response.data.groups;
}

export async function createTransactionGroup(
  bankId: string,
  name: string,
): Promise<TransactionGroup> {
  const response = await apiClient.post<{ group: TransactionGroup }>("/groups", {
    bankId,
    name,
  });
  return response.data.group;
}

export async function renameTransactionGroup(
  bankId: string,
  groupId: string,
  name: string,
): Promise<TransactionGroup> {
  const response = await apiClient.patch<{ group: TransactionGroup }>(
    `/groups/${encodeURIComponent(groupId)}`,
    { bankId, name },
  );
  return response.data.group;
}

export async function deleteTransactionGroup(bankId: string, groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${encodeURIComponent(groupId)}`, { params: { bankId } });
}

export async function assignTransactionToGroup(
  bankId: string,
  groupId: string,
  transactionId: string,
): Promise<TransactionGroupMembership> {
  const response = await apiClient.put<{ membership: TransactionGroupMembership }>(
    `/groups/${encodeURIComponent(groupId)}/transactions/${encodeURIComponent(transactionId)}`,
    { bankId },
  );
  return response.data.membership;
}

export async function unassignTransaction(bankId: string, transactionId: string): Promise<void> {
  await apiClient.delete(`/groups/transactions/${encodeURIComponent(transactionId)}`, {
    params: { bankId },
  });
}

export async function listTransactionGroupMemberships(
  bankId: string,
): Promise<TransactionGroupMembership[]> {
  const response = await apiClient.get<{ memberships: TransactionGroupMembership[] }>(
    "/groups/memberships",
    { params: { bankId } },
  );
  return response.data.memberships;
}

/** Browser client for Easy Start pending Deposit to Earn (`/api/easy-start`). */

import {
  parsePendingEarnDeposit,
  type PendingEarnDeposit,
} from "@/lib/easyStart/pendingEarnDeposit";

function easyStartBase(): string {
  const raw = import.meta.env.VITE_EASY_START_API_BASE as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/+$/, "");
  return "/api/easy-start";
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Easy Start API ${res.status}`
    );
  }
  return data;
}

export async function fetchRemotePendingEarnDeposit(
  accessToken: string,
  signal?: AbortSignal
): Promise<PendingEarnDeposit | null> {
  const res = await fetch(`${easyStartBase()}/pending-deposit`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  const data = await parseJson<{ job?: unknown }>(res);
  return parsePendingEarnDeposit(data.job);
}

export async function putRemotePendingEarnDeposit(
  accessToken: string,
  job: PendingEarnDeposit,
  signal?: AbortSignal
): Promise<PendingEarnDeposit> {
  const res = await fetch(`${easyStartBase()}/pending-deposit`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(job),
    signal,
  });
  const data = await parseJson<{ job?: unknown }>(res);
  return parsePendingEarnDeposit(data.job) ?? job;
}

export async function deleteRemotePendingEarnDeposit(
  accessToken: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${easyStartBase()}/pending-deposit`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  if (res.status === 404) return;
  await parseJson<{ ok?: boolean }>(res);
}

const RESTORE_KEY = "dorkfi_restore_vote_success";

export type VoteSuccessRestoreState = {
  proposalId: string;
  support: boolean;
  votingPower: number;
};

export function storeVoteSuccessRestore(state: VoteSuccessRestoreState): void {
  sessionStorage.setItem(RESTORE_KEY, JSON.stringify(state));
}

export function consumeVoteSuccessRestore(
  proposalId: string
): VoteSuccessRestoreState | null {
  const raw = sessionStorage.getItem(RESTORE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as VoteSuccessRestoreState;
    if (parsed.proposalId !== proposalId) return null;
    sessionStorage.removeItem(RESTORE_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(RESTORE_KEY);
    return null;
  }
}

export function clearOAuthReturnQueryParams(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("x_connected") && !params.has("x_error")) return;
  params.delete("x_connected");
  params.delete("x_error");
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

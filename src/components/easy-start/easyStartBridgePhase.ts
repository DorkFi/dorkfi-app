/** Shared Easy Start bridge progress types/labels (no wagmi imports). */

export type EasyStartBridgeDirection = "base-to-algo" | "algo-to-base";

export type EasyStartBridgePhase =
  | "preparing"
  | "signing"
  | "sending"
  | "waiting"
  | "success"
  | "error";

export function mapBridgeStatusToPhase(
  status: string,
  ready: boolean
): EasyStartBridgePhase {
  if (!ready) return "preparing";
  switch (status) {
    case "idle":
    case "quoting":
      return "preparing";
    case "opting-in":
    case "permit-signing":
    case "approving":
    case "bundling":
    case "signing":
      return "signing";
    case "sending":
    case "opt-in-sent":
      return "sending";
    case "waiting":
    case "watching-funding":
      return "waiting";
    case "success":
      return "success";
    case "error":
      return "error";
    default:
      return "preparing";
  }
}

export function bridgePhaseLabel(
  phase: EasyStartBridgePhase,
  direction: EasyStartBridgeDirection = "base-to-algo"
): string {
  const isWithdraw = direction === "algo-to-base";
  switch (phase) {
    case "preparing":
      return isWithdraw
        ? "Preparing your withdrawal…"
        : "Preparing your deposit…";
    case "signing":
      return "Confirm in your wallet…";
    case "sending":
      return "Sending funds…";
    case "waiting":
      return "Almost done — finishing transfer…";
    case "success":
      return isWithdraw ? "Withdrawal complete" : "Deposit complete";
    case "error":
      return isWithdraw
        ? "Withdrawal couldn’t finish"
        : "Deposit couldn’t finish";
  }
}

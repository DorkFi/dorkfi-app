import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleTransactionMetadataUpdate } from "./transactionUtils";

describe("scheduleTransactionMetadataUpdate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not fetch when txId is missing or blank", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    scheduleTransactionMetadataUpdate("", "algorand-mainnet");
    scheduleTransactionMetadataUpdate("   ", "algorand-mainnet");
    scheduleTransactionMetadataUpdate(null, "algorand-mainnet");
    scheduleTransactionMetadataUpdate(undefined, "algorand-mainnet");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs metadata in the background", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    scheduleTransactionMetadataUpdate("ABC123", "algorand-mainnet");
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/transaction-metadata/ABC123"
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "network=algorand-mainnet"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });
});

import { describe, expect, it } from "vitest";
import { orderBorrowBuildProbes } from "@/services/lendingService";

describe("orderBorrowBuildProbes", () => {
  it("skips balance-box variants when the token never needs a box", () => {
    expect(orderBorrowBuildProbes(false, "unknown")).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  it("omits createBalanceBox when the box is already present", () => {
    expect(orderBorrowBuildProbes(true, "present")).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  it("prefers create-box path when the box is missing, with no-box fallbacks", () => {
    expect(orderBorrowBuildProbes(true, "missing")).toEqual([
      [1, 0],
      [1, 1],
      [0, 0],
      [0, 1],
    ]);
  });

  it("falls back to returning-user-first order when status is unknown", () => {
    expect(orderBorrowBuildProbes(true, "unknown")).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });
});

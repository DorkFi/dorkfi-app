import { describe, expect, it } from "vitest";
import {
  HAYSTACK_REPAY_GROUP_BUDGET,
  haystackRepayMaxGroupSize,
} from "@/services/haystackAtomicRepay";

describe("haystackAtomicRepay group budget", () => {
  it("reserves enough slots so ALGO→WAD compact swaps leave room for repay", () => {
    expect(HAYSTACK_REPAY_GROUP_BUDGET).toBeGreaterThanOrEqual(10);
    expect(haystackRepayMaxGroupSize()).toBe(16 - HAYSTACK_REPAY_GROUP_BUDGET);
    // Live ALGO→WAD routes fit in 6 txns at this cap; repay+GRS need the rest.
    expect(haystackRepayMaxGroupSize()).toBeLessThanOrEqual(6);
  });
});

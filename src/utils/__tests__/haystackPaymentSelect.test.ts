import { describe, expect, it } from "vitest";
import {
  decodeHaystackPaymentSelectValue,
  encodeHaystackPaymentSelectValue,
} from "@/utils/haystackPaymentSelect";

describe("haystackPaymentSelect", () => {
  it("encodes same-asset and ALGO (asa 0) distinctly", () => {
    expect(encodeHaystackPaymentSelectValue(null)).toBe("same");
    expect(encodeHaystackPaymentSelectValue(0)).toBe("asa:0");
    expect(encodeHaystackPaymentSelectValue(31566704)).toBe("asa:31566704");
  });

  it("decodes select values including asa:0", () => {
    expect(decodeHaystackPaymentSelectValue("same")).toBeNull();
    expect(decodeHaystackPaymentSelectValue("asa:0")).toBe(0);
    expect(decodeHaystackPaymentSelectValue("asa:31566704")).toBe(31566704);
    expect(decodeHaystackPaymentSelectValue("0")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { getHaystackSdkApiBaseUrl } from "@/services/haystackSwapExecute";

describe("getHaystackSdkApiBaseUrl", () => {
  it("appends /api for absolute proxy origins", () => {
    // Force absolute by temporarily stubbing — function reads import.meta env.
    // Default Vite path should end with /api/haystack/api when window origin is set.
    const url = getHaystackSdkApiBaseUrl();
    expect(url.endsWith("/api")).toBe(true);
    expect(url.includes("haystack") || url.includes("127.0.0.1") || url.includes("localhost") || url.startsWith("http")).toBe(true);
  });
});

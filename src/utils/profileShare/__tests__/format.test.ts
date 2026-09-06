import { describe, expect, it } from "vitest";
import {
  buildProfileShareTweetText,
  resolveProfileShareCollection,
} from "../format";

describe("resolveProfileShareCollection", () => {
  it("resolves by contract id", () => {
    expect(resolveProfileShareCollection({ contractId: 313597 })).toBe(
      "dorks_v1"
    );
    expect(resolveProfileShareCollection({ contractId: 894888 })).toBe(
      "dorks_v2"
    );
    expect(resolveProfileShareCollection({ contractId: 313705 })).toBe(
      "lil_chubs"
    );
  });

  it("resolves by name prefix", () => {
    expect(resolveProfileShareCollection({ nftName: "DORK 12" })).toBe(
      "dorks_v1"
    );
    expect(resolveProfileShareCollection({ nftName: "DORKS 5" })).toBe(
      "dorks_v2"
    );
    expect(resolveProfileShareCollection({ nftName: "CHUB 2" })).toBe(
      "lil_chubs"
    );
  });
});

describe("buildProfileShareTweetText", () => {
  it("uses 4 $UNIT for DORK v1", () => {
    const text = buildProfileShareTweetText({
      nftName: "DORK 001",
      contractId: 313597,
      shareUrl: "https://example.com/profile/abc",
    });
    expect(text).toContain(
      "DORK 001 earns me 4 $UNIT each week and adds to my voting power."
    );
    expect(text).toContain("https://example.com/profile/abc");
  });

  it("uses 0.8 $UNIT for DORK v2", () => {
    const text = buildProfileShareTweetText({
      nftName: "DORKS 12",
      contractId: 894888,
    });
    expect(text).toContain("DORKS 12 earns me 0.8 $UNIT each week");
  });

  it("uses the non-earning line for CHUB", () => {
    const text = buildProfileShareTweetText({
      nftName: "CHUB 002",
      contractId: 313705,
    });
    expect(text).toContain(
      "CHUB 002 may not earn $UNIT each week, but it looks great and adds to my voting power."
    );
    expect(text).not.toContain("earns me");
  });
});

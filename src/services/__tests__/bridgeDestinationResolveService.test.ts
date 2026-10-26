import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveBridgeDestinationInput } from "@/services/bridgeDestinationResolveService";

describe("resolveBridgeDestinationInput", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes through a valid address", async () => {
    const addr =
      "EM6YOBT4UOMEGWZO74OLOSA55V6EH6DUQSCAJA6FNMQ5IS5U3GZXBUR2OI";
    const result = await resolveBridgeDestinationInput(addr, "algorand-to-voi");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.address).toBe(addr);
      expect(result.matched).toBe("address");
    }
  });

  it("rejects .algo names on algorand-to-voi", async () => {
    const result = await resolveBridgeDestinationInput(
      "haroof.algo",
      "algorand-to-voi"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Voi/);
  });

  it("rejects .voi names on voi-to-algorand", async () => {
    const result = await resolveBridgeDestinationInput(
      "haroof.voi",
      "voi-to-algorand"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Algorand/);
  });

  it("resolves enVoi names on algorand-to-voi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.envoi.sh")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  name: "haroof.voi",
                  address:
                    "EM6YOBT4UOMEGWZO74OLOSA55V6EH6DUQSCAJA6FNMQ5IS5U3GZXBUR2OI",
                  metadata: { avatar_dorkfi: "arc72:313597:11" },
                },
              ],
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );

    const result = await resolveBridgeDestinationInput(
      "haroof.voi",
      "algorand-to-voi"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matched).toBe("envoi");
      expect(result.displayName).toBe("haroof.voi");
      expect(result.nftLabel).toBe("DORK 11");
    }
  });

  it("resolves NFD names on voi-to-algorand", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.nf.domains")) {
          return {
            ok: true,
            json: async () => ({
              name: "haroof.algo",
              owner:
                "GNOTKABPECN5HOHUW5IJLPZOEIDA7HAROOF4BY6ITWI5RJYHFPHXQ3ERVQ",
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );

    const result = await resolveBridgeDestinationInput(
      "haroof.algo",
      "voi-to-algorand"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matched).toBe("nfd");
      expect(result.address).toBe(
        "GNOTKABPECN5HOHUW5IJLPZOEIDA7HAROOF4BY6ITWI5RJYHFPHXQ3ERVQ"
      );
    }
  });
});

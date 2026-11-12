import { describe, expect, it } from "vitest";
import {
  fitPeraConnectMobileSheet,
  pinPeraConnectModalOverlay,
} from "./pinPeraConnectModalViewport";

function sheetOverlay(options: {
  mobile: boolean;
  scrollHeight: number;
  clientHeight: number;
  scrollTop?: number;
}) {
  const sheet = {
    style: { maxHeight: "" },
    scrollHeight: options.scrollHeight,
    clientHeight: options.clientHeight,
    scrollTop: options.scrollTop ?? 0,
  };
  return {
    sheet,
    overlay: {
      classList: { contains: (token: string) => options.mobile && token.endsWith("--mobile") },
      querySelector: () => sheet,
    },
  };
}

describe("pinPeraConnectModalOverlay", () => {
  it("sizes the overlay to the visible viewport", () => {
    const overlay = { style: { top: "", height: "", bottom: "0px" } };

    pinPeraConnectModalOverlay(overlay, { height: 640, offsetTop: 12 });

    expect(overlay.style.top).toBe("12px");
    expect(overlay.style.height).toBe("640px");
    expect(overlay.style.bottom).toBe("auto");
  });

  it("keeps an overlay that is already aligned with the viewport", () => {
    const overlay = {
      style: { top: "0.2px", height: "800.2px", bottom: "auto" },
    };

    pinPeraConnectModalOverlay(overlay, { height: 800, offsetTop: 0 });

    expect(overlay.style).toEqual({
      top: "0.2px",
      height: "800.2px",
      bottom: "auto",
    });
  });
});

describe("fitPeraConnectMobileSheet", () => {
  it("leaves the desktop card alone", () => {
    const { overlay, sheet } = sheetOverlay({
      mobile: false,
      scrollHeight: 800,
      clientHeight: 500,
    });

    fitPeraConnectMobileSheet(overlay);

    expect(sheet.style.maxHeight).toBe("");
    expect(sheet.scrollTop).toBe(0);
  });

  it("keeps a sheet that already fits unscrolled", () => {
    const { overlay, sheet } = sheetOverlay({
      mobile: true,
      scrollHeight: 480,
      clientHeight: 520,
    });

    fitPeraConnectMobileSheet(overlay);

    expect(sheet.style.maxHeight).toBe("100%");
    expect(sheet.scrollTop).toBe(0);
  });

  it("starts an overflowing sheet at the launch button", () => {
    const { overlay, sheet } = sheetOverlay({
      mobile: true,
      scrollHeight: 700,
      clientHeight: 520,
    });

    fitPeraConnectMobileSheet(overlay);

    expect(sheet.style.maxHeight).toBe("100%");
    expect(sheet.scrollTop).toBe(700);
  });

  it("follows layout growth until the user scrolls up", () => {
    const { overlay, sheet } = sheetOverlay({
      mobile: true,
      scrollHeight: 560,
      clientHeight: 520,
    });

    fitPeraConnectMobileSheet(overlay);
    sheet.scrollHeight = 700;
    fitPeraConnectMobileSheet(overlay);

    expect(sheet.scrollTop).toBe(700);
  });

  it("does not jump back down after the user scrolls up to close", () => {
    const { overlay, sheet } = sheetOverlay({
      mobile: true,
      scrollHeight: 700,
      clientHeight: 520,
    });

    fitPeraConnectMobileSheet(overlay);
    sheet.scrollTop = 0;
    fitPeraConnectMobileSheet(overlay);

    expect(sheet.scrollTop).toBe(0);
  });
});

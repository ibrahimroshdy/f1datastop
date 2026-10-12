import { describe, expect, it } from "vitest";
import { consentFromTcData } from "./consentBridge";

describe("consentFromTcData", () => {
  it("grants everything when GDPR does not apply", () => {
    expect(consentFromTcData({ gdprApplies: false })).toEqual({ ad: "granted", analytics: "granted" });
  });

  it("waits while the consent dialog is open", () => {
    expect(consentFromTcData({ gdprApplies: true, eventStatus: "cmpuishown" })).toBeNull();
  });

  it("denies when nothing was consented", () => {
    expect(
      consentFromTcData({ gdprApplies: true, eventStatus: "useractioncomplete", purpose: { consents: {} } }),
    ).toEqual({ ad: "denied", analytics: "denied" });
  });

  it("grants analytics only with purposes 1 and 8", () => {
    expect(
      consentFromTcData({
        gdprApplies: true,
        eventStatus: "tcloaded",
        purpose: { consents: { 1: true, 8: true } },
      }),
    ).toEqual({ ad: "denied", analytics: "granted" });
  });

  it("grants ads only with purposes 1, 3 and 4", () => {
    expect(
      consentFromTcData({
        gdprApplies: true,
        eventStatus: "useractioncomplete",
        purpose: { consents: { 1: true, 3: true, 4: true } },
      }),
    ).toEqual({ ad: "granted", analytics: "denied" });
  });
});

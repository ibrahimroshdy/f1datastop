import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeConsent, sendToGtag } from "./consentBridge";

type Listener = (data: unknown, success: boolean) => void;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sendToGtag", () => {
  it("sends a Consent Mode update with all four signals", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    sendToGtag("denied", "granted");
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("is a no-op when gtag is not loaded", () => {
    vi.stubGlobal("window", {});
    expect(() => sendToGtag("granted", "granted")).not.toThrow();
  });
});

describe("bridgeConsent", () => {
  it("forwards the CMP decision to gtag once the visitor decides", () => {
    vi.useFakeTimers();
    let listener: Listener | undefined;
    const gtag = vi.fn();
    const win = {
      gtag,
      __tcfapi: (_c: string, _v: number, cb: Listener) => {
        listener = cb;
      },
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
      clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
    };
    vi.stubGlobal("window", win);

    bridgeConsent({ gtag: true });
    vi.advanceTimersByTime(300);
    expect(listener).toBeDefined();

    listener!({ gdprApplies: true, eventStatus: "cmpuishown" }, true);
    expect(gtag).not.toHaveBeenCalled();

    listener!(
      { gdprApplies: true, eventStatus: "useractioncomplete", purpose: { consents: { 1: true, 8: true } } },
      true,
    );
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });
});

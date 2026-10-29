import { beforeEach, describe, expect, it } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import {
  useSpoilerShield,
  getLatestRace,
  isShieldedByDefault,
  type RaceScheduleEntry,
} from "./useSpoilerShield";

const storageKey = (season: number) => `f1ds-spoiler-shield-${season}`;

const pastRaces: RaceScheduleEntry[] = [
  { round: "1", raceName: "Australian Grand Prix", date: "2025-03-16", time: "05:00:00" },
  { round: "2", raceName: "Chinese Grand Prix", date: "2025-03-23", time: "06:00:00" },
  { round: "3", raceName: "Japanese Grand Prix", date: "2026-04-05", time: "05:00:00" },
];
const futureRaces: RaceScheduleEntry[] = [
  { round: "10", raceName: "Future Grand Prix", date: "2031-03-16" },
];

// Captures the hook return value from a server-rendered probe component.
let captured: ReturnType<typeof useSpoilerShield> | null = null;

function Probe({ races }: { races: RaceScheduleEntry[] | null }) {
  captured = useSpoilerShield({ season: 2026, races });
  return null;
}

function renderProbe(races: RaceScheduleEntry[] | null): void {
  renderToString(React.createElement(Probe, { races }));
}

describe("getLatestRace", () => {
  it("returns the most recent race whose date has passed", () => {
    expect(getLatestRace(pastRaces)?.round).toBe("3");
  });

  it("returns null when every race is still upcoming", () => {
    expect(getLatestRace(futureRaces)).toBeNull();
  });

  it("returns null for an empty or missing schedule", () => {
    expect(getLatestRace([])).toBeNull();
    expect(getLatestRace(null)).toBeNull();
    expect(getLatestRace(undefined)).toBeNull();
  });

  it("ignores future races when past races exist", () => {
    const mixed = [...pastRaces, ...futureRaces];
    expect(getLatestRace(mixed)?.round).toBe("3");
  });
});

describe("isShieldedByDefault", () => {
  it("shields when there is a latest race and no stored choice", () => {
    expect(isShieldedByDefault(null, true)).toBe(true);
  });

  it("does not shield when there is no latest race", () => {
    expect(isShieldedByDefault(null, false)).toBe(false);
  });

  it("keeps results shown once the user has shown them", () => {
    expect(isShieldedByDefault("shown", true)).toBe(false);
    expect(isShieldedByDefault("shown", false)).toBe(false);
  });

  it("respects a stored 'shielded' choice", () => {
    expect(isShieldedByDefault("shielded", false)).toBe(true);
  });
});

describe("useSpoilerShield", () => {
  beforeEach(() => {
    localStorage.clear();
    captured = null;
  });

  it("defaults to hidden when a latest race exists", () => {
    renderProbe(pastRaces);
    expect(captured).not.toBeNull();
    expect(captured!.isShielded).toBe(true);
    expect(captured!.latestRace?.round).toBe("3");
    expect(captured!.hasLatestRace).toBe(true);
  });

  it("defaults to shown when there is no latest race", () => {
    renderProbe(futureRaces);
    expect(captured!.isShielded).toBe(false);
    expect(captured!.hasLatestRace).toBe(false);
  });

  it("showResults writes the choice to localStorage and is remembered", () => {
    const key = storageKey(2026);
    renderProbe(pastRaces);
    expect(captured!.isShielded).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();

    captured!.showResults();
    expect(localStorage.getItem(key)).toBe("shown");

    renderProbe(pastRaces);
    expect(captured!.isShielded).toBe(false);
  });
});

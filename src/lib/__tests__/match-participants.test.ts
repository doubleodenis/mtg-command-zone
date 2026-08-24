import { describe, it, expect } from "vitest";
import {
  findFirstEmptyIndex,
  replaceParticipant,
  shiftInsertParticipant,
  moveParticipant,
} from "@/lib/match-participants";
import type { ParticipantSlot } from "@/components/match/match-form-types";

const empty = (): ParticipantSlot => ({ type: "empty", isWinner: false });
const player = (userId: string): ParticipantSlot => ({
  type: "registered",
  userId,
  username: userId,
  isWinner: false,
});

describe("findFirstEmptyIndex", () => {
  it("returns the first empty index across the whole array when no scope is given", () => {
    const participants = [player("a"), empty(), player("c"), empty()];
    expect(findFirstEmptyIndex(participants)).toBe(1);
  });

  it("returns the first empty index within the given scope only", () => {
    const participants = [empty(), player("b"), player("c"), empty()];
    expect(findFirstEmptyIndex(participants, [1, 2])).toBe(null);
    expect(findFirstEmptyIndex(participants, [2, 3])).toBe(3);
  });

  it("returns null when there is no empty slot", () => {
    const participants = [player("a"), player("b")];
    expect(findFirstEmptyIndex(participants)).toBe(null);
  });
});

describe("replaceParticipant", () => {
  it("replaces only the target index and does not mutate the input", () => {
    const participants = [player("a"), empty(), player("c")];
    const next = replaceParticipant(participants, 1, player("x"));

    expect(next).toEqual([player("a"), player("x"), player("c")]);
    expect(participants[1]).toEqual(empty());
  });
});

describe("shiftInsertParticipant", () => {
  it("shifts occupants toward an empty slot that comes after the target", () => {
    // scope [0,1,2,3] = [P0, P1, P2, empty]; drop at index 1
    const participants = [player("p0"), player("p1"), player("p2"), empty()];
    const next = shiftInsertParticipant(participants, 1, player("x"), [0, 1, 2, 3]);

    expect(next).toEqual([player("p0"), player("x"), player("p1"), player("p2")]);
  });

  it("shifts occupants toward an empty slot that comes before the target", () => {
    // scope [0,1,2,3] = [empty, P1, P2, P3]; drop at index 2
    const participants = [empty(), player("p1"), player("p2"), player("p3")];
    const next = shiftInsertParticipant(participants, 2, player("x"), [0, 1, 2, 3]);

    expect(next).toEqual([player("p1"), player("p2"), player("x"), player("p3")]);
  });

  it("falls back to a replace when there is no empty slot in scope", () => {
    const participants = [player("p0"), player("p1"), player("p2")];
    const next = shiftInsertParticipant(participants, 1, player("x"), [0, 1, 2]);

    expect(next).toEqual([player("p0"), player("x"), player("p2")]);
  });

  it("ignores slots outside the given scope", () => {
    // index 3 is empty but out of scope [0,1,2] — must fall back to replace
    const participants = [player("p0"), player("p1"), player("p2"), empty()];
    const next = shiftInsertParticipant(participants, 1, player("x"), [0, 1, 2]);

    expect(next).toEqual([player("p0"), player("x"), player("p2"), empty()]);
  });
});

describe("moveParticipant", () => {
  it("swaps two filled slots", () => {
    const participants = [player("a"), player("b")];
    const next = moveParticipant(participants, 0, 1);

    expect(next).toEqual([player("b"), player("a")]);
  });

  it("relocates a player into an empty target, leaving the source empty", () => {
    const participants = [player("a"), empty()];
    const next = moveParticipant(participants, 0, 1);

    expect(next).toEqual([empty(), player("a")]);
  });

  it("is a no-op when moving a slot onto itself", () => {
    const participants = [player("a"), player("b")];
    const next = moveParticipant(participants, 0, 0);

    expect(next).toEqual(participants);
  });
});

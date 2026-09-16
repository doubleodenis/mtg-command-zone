import type { ParticipantSlot } from "@/components/match/match-form-types";

/**
 * Returns the first empty-slot index, searching `scopeIndices` in ascending
 * order if given, otherwise every index in `participants`.
 */
export function findFirstEmptyIndex(
  participants: ParticipantSlot[],
  scopeIndices?: number[]
): number | null {
  const indices = scopeIndices ?? participants.map((_, i) => i);
  for (const index of indices) {
    if (participants[index]?.type === "empty") return index;
  }
  return null;
}

export function replaceParticipant(
  participants: ParticipantSlot[],
  targetIndex: number,
  newSlot: ParticipantSlot
): ParticipantSlot[] {
  const next = [...participants];
  next[targetIndex] = newSlot;
  return next;
}

/**
 * Inserts `newSlot` at `targetIndex`, shifting every occupant strictly
 * between `targetIndex` and the nearest empty slot (by distance) within
 * `scopeIndices` by one position toward that empty slot. Falls back to a
 * plain replace (dropping the previous occupant) when `scopeIndices` has
 * no empty slot other than `targetIndex` itself.
 */
export function shiftInsertParticipant(
  participants: ParticipantSlot[],
  targetIndex: number,
  newSlot: ParticipantSlot,
  scopeIndices: number[]
): ParticipantSlot[] {
  const emptyCandidates = scopeIndices.filter(
    (i) => i !== targetIndex && participants[i]?.type === "empty"
  );

  if (emptyCandidates.length === 0) {
    return replaceParticipant(participants, targetIndex, newSlot);
  }

  const emptyIndex = emptyCandidates.reduce((nearest, candidate) =>
    Math.abs(candidate - targetIndex) < Math.abs(nearest - targetIndex)
      ? candidate
      : nearest
  );

  const sorted = [...scopeIndices].sort((a, b) => a - b);
  const targetPos = sorted.indexOf(targetIndex);
  const emptyPos = sorted.indexOf(emptyIndex);
  const next = [...participants];

  if (emptyPos > targetPos) {
    for (let pos = emptyPos; pos > targetPos; pos--) {
      next[sorted[pos]] = next[sorted[pos - 1]];
    }
  } else {
    for (let pos = emptyPos; pos < targetPos; pos++) {
      next[sorted[pos]] = next[sorted[pos + 1]];
    }
  }

  next[targetIndex] = newSlot;
  return next;
}

/**
 * Swaps the contents of two slots. Swapping with an empty slot is
 * equivalent to relocating the player and leaving the source empty.
 */
export function moveParticipant(
  participants: ParticipantSlot[],
  fromIndex: number,
  toIndex: number
): ParticipantSlot[] {
  if (fromIndex === toIndex) return participants;
  const next = [...participants];
  const temp = next[toIndex];
  next[toIndex] = next[fromIndex];
  next[fromIndex] = temp;
  return next;
}

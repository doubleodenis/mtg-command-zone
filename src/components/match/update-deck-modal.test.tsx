import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpdateDeckModal } from "./update-deck-modal";

vi.mock("@/app/actions/match", () => ({ confirmMatch: vi.fn(), updateMatchParticipantDeck: vi.fn() }));

const deck = (id: string, deckName: string) => ({
  id, deckName, commanderName: `${deckName} commander`, partnerName: null, colorIdentity: [], bracket: 2 as const,
});

describe("UpdateDeckModal", () => {
  it("never offers the Unknown Deck placeholder", () => {
    render(
      <UpdateDeckModal
        isOpen
        onClose={() => {}}
        participantId="p1"
        currentDeckId="placeholder"
        decks={[deck("placeholder", "Unknown Deck"), deck("real", "Superfriends")]}
        isConfirmed={false}
      />
    );
    // The row renders both deckName and commanderName, so match all.
    expect(screen.queryAllByText(/Unknown Deck/)).toHaveLength(0);
    expect(screen.getByText("Superfriends")).toBeInTheDocument();
  });

  it("does not preselect the placeholder, so confirm stays disabled until a real deck is picked", () => {
    render(
      <UpdateDeckModal
        isOpen
        onClose={() => {}}
        participantId="p1"
        currentDeckId="placeholder"
        decks={[deck("placeholder", "Unknown Deck"), deck("real", "Superfriends")]}
        isConfirmed={false}
      />
    );
    expect(screen.getByRole("button", { name: "Confirm & Update" })).toBeDisabled();
  });

  it("shows the empty state when only the placeholder deck exists", () => {
    render(
      <UpdateDeckModal
        isOpen
        onClose={() => {}}
        participantId="p1"
        currentDeckId="placeholder"
        decks={[deck("placeholder", "Unknown Deck")]}
        isConfirmed={false}
      />
    );
    expect(screen.getByText("No decks available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm & Update" })).toBeDisabled();
  });
});

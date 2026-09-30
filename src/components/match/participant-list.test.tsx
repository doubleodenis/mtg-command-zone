import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ParticipantList } from "./participant-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/match", () => ({ claimSlotWithAutoApproval: vi.fn() }));
vi.mock("@/components/match/update-deck-modal", () => ({ UpdateDeckModal: () => null }));
vi.mock("@/components/match/post-claim-modal", () => ({ PostClaimModal: () => null }));

type Participant = React.ComponentProps<typeof ParticipantList>["participants"][number];

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "p1",
    name: "Alice",
    username: "alice",
    avatarUrl: null,
    userId: "u1",
    isWinner: false,
    isConfirmed: true,
    ratingDelta: null,
    deck: { id: "d1", commanderName: "Atraxa", deckName: "Superfriends", bracket: 3 },
    ...overrides,
  };
}

function renderList(participants: Participant[], currentUserId: string | null = null) {
  return render(
    <ParticipantList
      participants={participants}
      currentUserId={currentUserId}
      userDecks={[]}
      matchCreatorId="u1"
      matchCreatorUsername="alice"
    />
  );
}

describe("ParticipantList — profile links", () => {
  it("links a registered participant to their public profile", () => {
    renderList([participant()]);
    expect(screen.getByRole("link", { name: /alice/i })).toHaveAttribute("href", "/player/alice");
  });

  it("does not link a placeholder slot, even if its name looks like a username", () => {
    renderList([participant({ id: "p2", userId: null, username: null, name: "bob" })]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("renders plain text when a registered participant has no username", () => {
    renderList([participant({ username: null })]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("keeps action buttons outside the profile link", () => {
    renderList([participant({ isConfirmed: false })], "u1");
    const link = screen.getByRole("link", { name: /alice/i });
    const button = screen.getByRole("button", { name: /update deck/i });
    expect(within(link).queryByRole("button")).not.toBeInTheDocument();
    expect(link.contains(button)).toBe(false);
  });
});

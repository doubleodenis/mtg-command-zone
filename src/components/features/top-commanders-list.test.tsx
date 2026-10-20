import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopCommandersList } from "./top-commanders-list";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const ranked = {
  id: "Atraxa",
  commanderName: "Atraxa",
  partnerName: null,
  colorIdentity: ["W", "U", "B", "G"] as ("W" | "U" | "B" | "R" | "G")[],
  bracket: 3 as const,
  stats: { gamesPlayed: 4, wins: 3, losses: 1, winRate: 75 },
  qualified: true,
};

describe("TopCommandersList", () => {
  it("shows rank and win rate for a qualified commander", () => {
    render(<TopCommandersList commanders={[ranked]} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/4 games • 75% WR/)).toBeInTheDocument();
  });

  it("shows an unqualified commander unranked with the games still needed", () => {
    render(
      <TopCommandersList
        commanders={[
          ranked,
          { ...ranked, id: "Edgar", commanderName: "Edgar", qualified: false, stats: { gamesPlayed: 1, wins: 1, losses: 0, winRate: 100 } },
        ]}
      />
    );
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText(/1 game • needs 3 to rank/)).toBeInTheDocument();
    expect(screen.queryByText(/100% WR/)).not.toBeInTheDocument();
  });

  it("shows the bracket badge when every play shared a bracket", () => {
    render(<TopCommandersList commanders={[ranked]} />);
    expect(screen.getByText("Upgraded")).toBeInTheDocument();
  });

  it("omits the bracket badge entirely when a commander's bracket is mixed", () => {
    const { container } = render(<TopCommandersList commanders={[{ ...ranked, bracket: null }]} />);
    expect(screen.queryByText("Upgraded")).not.toBeInTheDocument();
    // No empty pill either: the badge element itself must not render.
    expect(container.querySelector("span.rounded-sm.border")).toBeNull();
  });

  it("shows both names for a partner pair", () => {
    render(<TopCommandersList commanders={[{ ...ranked, commanderName: "Thrasios", partnerName: "Tymna" }]} />);
    expect(screen.getByText("Thrasios + Tymna")).toBeInTheDocument();
  });
});

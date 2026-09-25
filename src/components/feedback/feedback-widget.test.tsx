import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
import { FeedbackWidget } from "./feedback-widget";

vi.mock("next/navigation", () => ({ usePathname: () => "/leaderboards" }));

describe("FeedbackWidget — shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a labelled trigger that is collapsed by default", () => {
    render(<FeedbackWidget />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the panel when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send feedback" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("defaults the intent to bug", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByRole("radio", { name: "Bug" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Idea" })).not.toBeChecked();
  });

  it("swaps the placeholder when the intent changes", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/your feedback/i)).toHaveAttribute(
      "placeholder",
      "What happened, and what did you expect instead?"
    );
    await user.click(screen.getByRole("radio", { name: "Idea" }));
    expect(screen.getByLabelText(/your feedback/i)).toHaveAttribute(
      "placeholder",
      "What would make CommandZone better?"
    );
  });

  it("prefills the email when one is supplied", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget defaultEmail="player@example.com" />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/email/i)).toHaveValue("player@example.com");
  });

  it("leaves the email blank for a signed-out visitor", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
  });

  it("shows a live character counter", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.type(screen.getByLabelText(/your feedback/i), "hello");
    expect(screen.getByText(`5 / ${MAX_FEEDBACK_LENGTH}`)).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("closes when Cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

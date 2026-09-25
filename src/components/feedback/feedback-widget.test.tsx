import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
import { FeedbackWidget } from "./feedback-widget";
import * as Sentry from "@sentry/nextjs";
import { toast } from "@/components/ui/toast";
import { FEEDBACK_STORAGE_KEY } from "@/lib/feedback";

vi.mock("@sentry/nextjs", () => ({
  captureFeedback: vi.fn(),
  lastEventId: vi.fn(() => undefined),
}));

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

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

  it("marks the counter as a warning at 90% of the cap and not below it", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    const textarea = screen.getByLabelText(/your feedback/i);

    const belowThreshold = "a".repeat(Math.ceil(MAX_FEEDBACK_LENGTH * 0.9) - 1);
    fireEvent.change(textarea, { target: { value: belowThreshold } });
    expect(screen.getByText(`${belowThreshold.length} / ${MAX_FEEDBACK_LENGTH}`)).not.toHaveClass(
      "text-gold"
    );

    const atThreshold = "a".repeat(Math.ceil(MAX_FEEDBACK_LENGTH * 0.9));
    fireEvent.change(textarea, { target: { value: atThreshold } });
    expect(screen.getByText(`${atThreshold.length} / ${MAX_FEEDBACK_LENGTH}`)).toHaveClass(
      "text-gold"
    );
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

  it("moves focus into the panel when it opens", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/your feedback/i)).toHaveFocus();
  });

  it("traps Tab within the panel, wrapping from the last focusable element to the first", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    const sendButton = screen.getByRole("button", { name: "Send" });
    sendButton.focus();
    expect(sendButton).toHaveFocus();

    await user.keyboard("{Tab}");

    expect(screen.getByRole("button", { name: "Close feedback form" })).toHaveFocus();
  });
});

async function openAndType(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Send feedback" }));
  await user.type(screen.getByLabelText(/your feedback/i), text);
  return user;
}

describe("FeedbackWidget — submission", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(Sentry.captureFeedback).mockReset();
    vi.mocked(Sentry.lastEventId).mockReturnValue(undefined);
    vi.mocked(toast).mockReset();
  });

  it("does not submit an empty message", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends the message, email and intent tag", async () => {
    render(<FeedbackWidget defaultEmail="player@example.com" />);
    const user = await openAndType("rating dropped after a win");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      { message: "rating dropped after a win", email: "player@example.com" },
      { captureContext: { tags: { intent: "bug", route: "/leaderboards" } } }
    );
  });

  it("includes the session name alongside the email when supplied", async () => {
    render(<FeedbackWidget defaultEmail="player@example.com" defaultName="Alex Rivera" />);
    const user = await openAndType("rating dropped after a win");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      { message: "rating dropped after a win", email: "player@example.com", name: "Alex Rivera" },
      { captureContext: { tags: { intent: "bug", route: "/leaderboards" } } }
    );
  });

  it("omits the name entirely when the session has none", async () => {
    render(<FeedbackWidget defaultEmail="player@example.com" />);
    const user = await openAndType("rating dropped after a win");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0][0]).not.toHaveProperty("name");
  });

  it("attaches the last event id to a bug report", async () => {
    vi.mocked(Sentry.lastEventId).mockReturnValue("evt-42");
    render(<FeedbackWidget />);
    const user = await openAndType("it crashed");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0][0]).toMatchObject({
      associatedEventId: "evt-42",
    });
  });

  it("never attaches an event id to an idea", async () => {
    vi.mocked(Sentry.lastEventId).mockReturnValue("evt-42");
    render(<FeedbackWidget />);
    const user = await openAndType("add a dark mode toggle");
    await user.click(screen.getByRole("radio", { name: "Idea" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0][0]).not.toHaveProperty(
      "associatedEventId"
    );
  });

  it("shows a success toast, closes the panel and returns focus to the trigger", async () => {
    render(<FeedbackWidget />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    const user = await openAndType("looks great");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" })
    );
    expect(trigger).toHaveFocus();
  });

  it("blocks a second submission inside the cooldown", async () => {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, String(Date.now()));
    render(<FeedbackWidget />);
    const user = await openAndType("second try");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: "warning" }));
  });

  it("keeps the typed message when sending fails", async () => {
    vi.mocked(Sentry.captureFeedback).mockImplementation(() => {
      throw new Error("network down");
    });
    render(<FeedbackWidget />);
    const user = await openAndType("this should survive");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/your feedback/i)).toHaveValue("this should survive");
  });
});

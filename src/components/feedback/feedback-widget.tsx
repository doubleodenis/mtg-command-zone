"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAX_FEEDBACK_LENGTH, type FeedbackIntent } from "@/lib/feedback";
import { transition } from "@/lib/motion";

const PLACEHOLDERS: Record<FeedbackIntent, string> = {
  bug: "What happened, and what did you expect instead?",
  idea: "What would make CommandZone better?",
};

interface FeedbackWidgetProps {
  /** The signed-in user's email, when there is one. */
  defaultEmail?: string | null;
}

export function FeedbackWidget({ defaultEmail }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [intent, setIntent] = React.useState<FeedbackIntent>("bug");
  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail ?? "");

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape closes from anywhere while the panel is open.
  React.useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // A click outside the panel and outside the trigger closes it.
  React.useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Send feedback"
            aria-modal="false"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={transition.fast}
            style={{ transformOrigin: "bottom right" }}
            className="w-80 rounded-lg border border-card-border bg-card p-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-ui font-semibold text-text-1">Send feedback</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close feedback form"
                className="rounded p-1 text-text-3 transition-colors hover:text-text-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              role="radiogroup"
              aria-label="Feedback type"
              className="mb-3 flex gap-2"
            >
              {(["bug", "idea"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={intent === value}
                  onClick={() => setIntent(value)}
                  className={cn(
                    "text-ui flex-1 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                    intent === value
                      ? "border-accent-ring bg-accent-fill text-text-1"
                      : "border-card-border bg-transparent text-text-2 hover:border-card-border-hi"
                  )}
                >
                  {value === "bug" ? "Bug" : "Idea"}
                </button>
              ))}
            </div>

            <label htmlFor="feedback-message" className="mb-1 block text-sm text-text-2">
              Your feedback
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
              placeholder={PLACEHOLDERS[intent]}
              rows={4}
              maxLength={MAX_FEEDBACK_LENGTH}
              className={cn(
                "w-full resize-none rounded-md border border-card-border bg-card px-3 py-2",
                "text-base text-text-1 placeholder:text-text-2",
                "focus:border-accent-ring focus:outline-none focus:ring-1 focus:ring-accent-ring"
              )}
            />
            <p
              className={cn(
                "mt-1 text-right text-xs",
                message.length >= MAX_FEEDBACK_LENGTH * 0.9 ? "text-text-2" : "text-text-3"
              )}
            >
              {message.length} / {MAX_FEEDBACK_LENGTH}
            </p>

            <label htmlFor="feedback-email" className="mb-1 mt-2 block text-sm text-text-2">
              Email <span className="text-text-3">(optional)</span>
            </label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button type="button" size="sm">
                Send
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        ref={triggerRef}
        type="button"
        size="icon"
        aria-label="Send feedback"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((open) => !open)}
        className="h-11 w-11 rounded-full"
      >
        <Bug className="h-5 w-5" />
      </Button>
    </div>
  );
}

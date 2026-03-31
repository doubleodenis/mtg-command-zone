"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommanderPicker } from "@/components/features/commander-picker";
import { ColorIdentity } from "@/components/ui/mana-pip";
import { BracketIndicator } from "@/components/ui/bracket-indicator";
import { FormErrorBanner } from "@/components/ui/form-feedback";
import { buildCommanderImageUrl } from "@/lib/scryfall/api";
import { getUserFriendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { createDeck, updateDeck, retireDeck, reactivateDeck } from "@/lib/supabase/decks";
import type { Deck, Bracket, ColorIdentity as ColorIdentityType } from "@/types";
import { BRACKET_OPTIONS } from "@/types";

type CommanderValue = {
  scryfall_id: string;
  name: string;
  image_uri: string;
  color_identity?: string[];
} | null;

interface DeckFormProps {
  /** Existing deck for edit mode */
  deck?: Deck;
  /** Whether this deck has been used in matches (locks editing) */
  hasMatches?: boolean;
  /** Current active status (for retire/reactivate) */
  isActive?: boolean;
  /** Form submission handler */
  onSubmit?: (data: DeckFormData) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Retire/reactivate handler */
  onToggleActive?: (active: boolean) => Promise<void>;
  className?: string;
}

export type DeckFormData = {
  deckName: string;
  commanderName: string;
  partnerName: string | null;
  colorIdentity: ColorIdentityType;
  bracket: Bracket;
};

/**
 * Deck creation/edit form.
 * Handles commander selection, deck naming, and bracket assignment.
 * When hasMatches is true, editing is locked (only retire is allowed).
 */
export function DeckForm({
  deck,
  hasMatches = false,
  isActive = true,
  onSubmit,
  onCancel,
  onToggleActive,
  className,
}: DeckFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isTogglingActive, setIsTogglingActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeState, setActiveState] = React.useState(isActive);

  // Form state
  const [deckName, setDeckName] = React.useState(deck?.deckName ?? "");
  const [commander, setCommander] = React.useState<CommanderValue>(
    deck
      ? {
          scryfall_id: "",
          name: deck.commanderName,
          image_uri: buildCommanderImageUrl(deck.commanderName, "normal"),
          color_identity: deck.colorIdentity,
        }
      : null
  );
  const [partner, setPartner] = React.useState<CommanderValue>(
    deck?.partnerName
      ? {
          scryfall_id: "",
          name: deck.partnerName,
          image_uri: buildCommanderImageUrl(deck.partnerName, "normal"),
        }
      : null
  );
  const [bracket, setBracket] = React.useState<Bracket>(deck?.bracket ?? 2);
  const [showPartner, setShowPartner] = React.useState(!!deck?.partnerName);

  // Derive color identity from commander(s)
  const colorIdentity = React.useMemo(() => {
    const colors = new Set<string>();
    if (commander?.color_identity) {
      commander.color_identity.forEach((c) => colors.add(c));
    }
    if (partner?.color_identity) {
      partner.color_identity.forEach((c) => colors.add(c));
    }
    // Sort in WUBRG order
    const order = ["W", "U", "B", "R", "G"];
    return order.filter((c) => colors.has(c)) as ColorIdentityType;
  }, [commander, partner]);

  const isEditMode = !!deck;
  const isLocked = isEditMode && hasMatches;
  const canSubmit = deckName.trim() && commander;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData: DeckFormData = {
        deckName: deckName.trim(),
        commanderName: commander!.name,
        partnerName: partner?.name ?? null,
        colorIdentity,
        bracket,
      };

      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // Default behavior: create/update deck via Supabase
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("You must be logged in to save a deck");
        }

        if (isEditMode && deck) {
          // Update existing deck
          const result = await updateDeck(supabase, deck.id, {
            deckName: formData.deckName,
            commanderName: formData.commanderName,
            partnerName: formData.partnerName,
            colorIdentity: formData.colorIdentity,
            bracket: formData.bracket,
          });

          if (!result.success) {
            throw new Error(result.error);
          }
        } else {
          // Create new deck
          const result = await createDeck(supabase, user.id, {
            commanderName: formData.commanderName,
            partnerName: formData.partnerName,
            deckName: formData.deckName,
            colorIdentity: formData.colorIdentity,
            bracket: formData.bracket,
          });

          if (!result.success) {
            throw new Error(result.error);
          }
        }

        router.push("/decks");
        router.refresh();
      }
    } catch (err) {
      setError(getUserFriendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/decks");
    }
  };

  const handleToggleActive = async () => {
    setIsTogglingActive(true);
    setError(null);

    try {
      const newActiveState = !activeState;
      if (onToggleActive) {
        await onToggleActive(newActiveState);
      } else if (deck) {
        // Default behavior: retire/reactivate via Supabase
        const supabase = createClient();
        const result = newActiveState
          ? await reactivateDeck(supabase, deck.id)
          : await retireDeck(supabase, deck.id);

        if (!result.success) {
          throw new Error(result.error);
        }
      }
      setActiveState(newActiveState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update deck status");
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Enhanced commander picker that captures color identity
  const handleCommanderChange = (value: CommanderValue) => {
    if (!isLocked) {
      setCommander(value);
    }
  };

  const handlePartnerChange = (value: CommanderValue) => {
    if (!isLocked) {
      setPartner(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
<FormErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Locked state notice */}
      {isLocked && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <LockIcon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-1">
                  This deck has been used in matches
                </p>
                <p className="text-xs text-text-2 mt-1">
                  Commander, partner, and bracket cannot be changed to preserve match history integrity.
                  You can still rename the deck or retire it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retired state notice */}
      {isEditMode && !activeState && (
        <Card className="border-text-3/30 bg-text-3/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-text-3/20 flex items-center justify-center shrink-0">
                <ArchiveIcon className="w-4 h-4 text-text-2" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-1">
                  This deck is retired
                </p>
                <p className="text-xs text-text-2 mt-1">
                  Retired decks are hidden from match creation but their history is preserved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commander Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Commander
            {isLocked && <Badge variant="outline">Locked</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked ? (
            // Read-only commander display
            <div className="space-y-4">
              <CommanderDisplay
                name={commander?.name ?? ""}
                imageUri={commander?.image_uri}
              />
              {partner && (
                <CommanderDisplay
                  name={partner.name}
                  imageUri={partner.image_uri}
                  label="Partner"
                />
              )}
              {colorIdentity.length > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-card-border">
                  <span className="text-sm text-text-2">Color Identity:</span>
                  <ColorIdentity colors={colorIdentity} />
                </div>
              )}
            </div>
          ) : (
            // Editable commander pickers
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-1 block mb-1.5">
                  Commander <span className="text-negative">*</span>
                </label>
                <CommanderPicker
                  value={commander}
                  onChange={handleCommanderChange}
                  placeholder="Search for your commander..."
                />
              </div>

              {/* Partner toggle */}
              {!showPartner ? (
                <button
                  type="button"
                  onClick={() => setShowPartner(true)}
                  className="text-sm text-accent hover:text-accent-hi transition-colors"
                >
                  + Add partner commander
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-text-1">
                      Partner Commander
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPartner(false);
                        setPartner(null);
                      }}
                      className="text-xs text-text-2 hover:text-negative transition-colors"
                    >
                      Remove partner
                    </button>
                  </div>
                  <CommanderPicker
                    value={partner}
                    onChange={handlePartnerChange}
                    placeholder="Search for partner commander..."
                  />
                </div>
              )}

              {/* Color identity display */}
              {colorIdentity.length > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-card-border">
                  <span className="text-sm text-text-2">Color Identity:</span>
                  <ColorIdentity colors={colorIdentity} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Deck Details */}
      <Card>
        <CardHeader>
          <CardTitle>Deck Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="deckName" className="text-sm font-medium text-text-1 block mb-1.5">
              Deck Name <span className="text-negative">*</span>
            </label>
            <Input
              id="deckName"
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g., Vampire Tribal, Treasure Storm..."
              required
            />
            <p className="text-xs text-text-3">
              Give your deck a memorable name to identify it in match logs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Power Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Power Level
            {isLocked && <Badge variant="outline">Locked</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-1 block mb-1.5">
              Bracket <span className="text-negative">*</span>
            </label>
            <div className="grid gap-2">
              {BRACKET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !isLocked && setBracket(option.value)}
                  disabled={isLocked}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border transition-all text-left",
                    bracket === option.value
                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                      : "border-card-border hover:border-card-border-hi",
                    isLocked && "opacity-60 cursor-not-allowed hover:border-card-border"
                  )}
                >
                  <BracketIndicator bracket={option.value} />
                  <div className="flex-1">
                    <div className="font-medium text-text-1">{option.label}</div>
                    <div className="text-xs text-text-2">{option.description}</div>
                  </div>
                  {bracket === option.value && (
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-3">
              Bracket affects rating calculations. Be honest about your deck's power level.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Retire Section (only in edit mode) */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Deck Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-1">
                  {activeState ? "Retire this deck" : "Reactivate this deck"}
                </p>
                <p className="text-xs text-text-2 mt-1">
                  {activeState
                    ? "Retired decks are hidden from match creation but their history is preserved."
                    : "Reactivating will make this deck available for match creation again."}
                </p>
              </div>
              <Button
                type="button"
                variant={activeState ? "outline" : "primary"}
                onClick={handleToggleActive}
                disabled={isTogglingActive}
              >
                {isTogglingActive
                  ? "Updating..."
                  : activeState
                  ? "Retire Deck"
                  : "Reactivate Deck"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting
            ? isEditMode
              ? "Saving..."
              : "Creating..."
            : isEditMode
            ? "Save Changes"
            : "Create Deck"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Read-only commander display for locked decks
 */
function CommanderDisplay({
  name,
  imageUri,
  label,
}: {
  name: string;
  imageUri?: string;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-card-border">
      {imageUri && (
        <div className="relative h-16 w-12 rounded overflow-hidden shrink-0">
          <Image
            src={imageUri}
            alt={name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div>
        {label && <p className="text-xs text-text-2 mb-0.5">{label}</p>}
        <p className="font-medium text-text-1">{name}</p>
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="4" width="20" height="5" rx="2" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
  );
}

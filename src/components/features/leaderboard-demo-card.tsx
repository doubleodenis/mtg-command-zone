"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ColorIdentity } from "@/components/ui/mana-pip";
import { RatingDelta } from "@/components/ui/rating-delta";
import { transition } from "@/lib/motion";
import type { ManaColor } from "@/app/_design-system";

/* ─────────────────────────────────────────
   MOCK DATA
   Fictional players for the demo animation
───────────────────────────────────────── */

interface MockPlayer {
  name: string;
  commander: string;
  colors: ManaColor[];
  rating: number;
  delta: number;
  placement: number;
}

const mockPlayers: MockPlayer[] = [
  {
    name: "Phoenix",
    commander: "The Ur-Dragon",
    colors: ["W", "U", "B", "R", "G"],
    rating: 1247,
    delta: 28,
    placement: 1,
  },
  {
    name: "Nightfall",
    commander: "Teysa Karlov",
    colors: ["W", "B"],
    rating: 1183,
    delta: 8,
    placement: 2,
  },
  {
    name: "Stormlight",
    commander: "Krenko, Mob Boss",
    colors: ["R"],
    rating: 1156,
    delta: -12,
    placement: 3,
  },
  {
    name: "Verdant",
    commander: "Atraxa, Praetors' Voice",
    colors: ["W", "U", "B", "G"],
    rating: 1134,
    delta: -24,
    placement: 4,
  },
];

/* ─────────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────────── */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.1,
    },
  },
};

const playerRowVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transition.normal,
  },
};

const placementVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transition.spring,
  },
};

const deltaVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.normal,
  },
};

/* ─────────────────────────────────────────
   PLACEMENT BADGE COMPONENT
───────────────────────────────────────── */

function PlacementBadge({ placement }: { placement: number }) {
  const colors = {
    1: "bg-gold/75 text-sm text-white",
    2: "bg-text-2/75 text-sm text-white",
    3: "bg-[#cd7f32]/75 text-sm text-white",
    4: "bg-bg-overlay text-text-2",
  };

  const labels = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-10 h-6  rounded-md text-xs font-display font-bold",
        colors[placement as keyof typeof colors]
      )}
    >
      {labels[placement as keyof typeof labels]}
    </span>
  );
}

/* ─────────────────────────────────────────
   PLAYER ROW COMPONENT
───────────────────────────────────────── */

interface PlayerRowProps {
  player: MockPlayer;
  showPlacement: boolean;
  showDelta: boolean;
}

function PlayerRow({ player, showPlacement, showDelta }: PlayerRowProps) {
  return (
    <motion.div
      variants={playerRowVariants}
      className="flex items-center gap-3 py-3 border-b border-card-border last:border-b-0"
    >
      {/* Placement badge */}
      <div className="w-10 shrink-0">
        <AnimatePresence>
          {showPlacement && (
            <motion.div
              variants={placementVariants}
              initial="hidden"
              animate="visible"
            >
              <PlacementBadge placement={player.placement} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-text-1 truncate">
            {player.name}
          </span>
          <ColorIdentity colors={player.colors} size="sm" />
        </div>
        <p className="text-xs text-text-3 truncate">{player.commander}</p>
      </div>

      {/* Rating + Delta */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-data text-sm text-text-2 tabular-nums">
          {player.rating}
        </span>
        <div className="w-12">
          <AnimatePresence>
            {showDelta && (
              <motion.div
                variants={deltaVariants}
                initial="hidden"
                animate="visible"
              >
                <RatingDelta delta={player.delta} size="sm" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   MAIN LEADERBOARD DEMO CARD COMPONENT
───────────────────────────────────────── */

export function LeaderboardDemoCard() {
  const shouldReduceMotion = useReducedMotion();
  const [animationPhase, setAnimationPhase] = useState<
    "players" | "placements" | "deltas"
  >(shouldReduceMotion ? "deltas" : "players");

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    // Animation timeline
    const timers: NodeJS.Timeout[] = [];

    // Phase 1: Players visible (starts immediately via container)
    // Phase 2: Show placements after players are visible
    timers.push(
      setTimeout(() => {
        setAnimationPhase("placements");
      }, 800)
    );

    // Phase 3: Show rating deltas
    timers.push(
      setTimeout(() => {
        setAnimationPhase("deltas");
      }, 1600)
    );

    return () => timers.forEach(clearTimeout);
  }, [shouldReduceMotion]);

  const showPlacements =
    animationPhase === "placements" || animationPhase === "deltas";
  const showDeltas = animationPhase === "deltas";

  // If reduced motion or touch device (no hover), render static version
  if (shouldReduceMotion) {
    return (
      <div
        className="perspective-[1000px]"
      >
        <Card className="bg-card shadow-xl">
          <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-label text-text-3">LEADERBOARD</span>
            <span className="text-mono-xs text-text-3">FREE FOR ALL</span>
          </div>
          <div>
            {mockPlayers.map((player) => (
              <div
                key={player.name}
                className="flex items-center gap-3 py-3 border-b border-card-border last:border-b-0"
              >
              <PlacementBadge placement={player.placement} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-text-1">
                    {player.name}
                  </span>
                  <ColorIdentity colors={player.colors} size="sm" />
                </div>
                <p className="text-xs text-text-3">{player.commander}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-data text-sm text-text-2 tabular-nums">
                  {player.rating}
                </span>
                <RatingDelta delta={player.delta} size="sm" />
              </div>
            </div>
          ))}
        </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="shadow-xl lg:perspective-[1000px] max-w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ rotateY: 0, rotateX: 0, scale: 1 }}
        animate={{ rotateY: -10, rotateX: 3, scale: 1 }}
        whileHover={{ scale: 1.02, rotateY: -4, rotateX: 2 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <Card className="bg-card shadow-xl">
          <CardContent className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between mb-4"
        >
          <span className="text-label text-text-3">LEADERBOARD</span>
          <span className="text-mono-xs text-text-3">FREE FOR ALL</span>
        </motion.div>

        {/* Player list */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {mockPlayers.map((player) => (
            <PlayerRow
              key={player.name}
              player={player}
              showPlacement={showPlacements}
              showDelta={showDeltas}
            />
          ))}
        </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

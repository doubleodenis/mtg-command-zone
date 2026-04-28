"use client";

import { motion, useReducedMotion, Variants } from "framer-motion";
import { ClipboardList, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { transition } from "@/lib/motion";

/* ─────────────────────────────────────────
   VALUE PROP DATA
───────────────────────────────────────── */

interface ValueProp {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const valueProps: ValueProp[] = [
  {
    icon: <ClipboardList className="w-8 h-8" strokeWidth={1.5} />,
    title: "Track",
    description: "Log matches in any format — 1v1, FFA, Pentagram, or Teams",
  },
  {
    icon: <Trophy className="w-8 h-8" strokeWidth={1.5} />,
    title: "Compete",
    description: "Elo ratings and leaderboards for you and your playgroup",
  },
  {
    icon: <Users className="w-8 h-8" strokeWidth={1.5} />,
    title: "Organize",
    description: "Create collections for pods, tournaments, and game nights",
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
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.slow,
  },
};

/* ─────────────────────────────────────────
   VALUE PROP CARD COMPONENT
───────────────────────────────────────── */

interface ValuePropCardProps {
  prop: ValueProp;
  className?: string;
}

function ValuePropCard({ prop, className }: ValuePropCardProps) {
  return (
    <Card className={cn("bg-card", className)}>
      <CardContent className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent-dim text-accent mb-4">
          {prop.icon}
        </div>
        <h3 className="font-display text-xl font-bold text-text-1 mb-2">
          {prop.title}
        </h3>
        <p className="text-sm text-text-2">{prop.description}</p>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────
   MAIN FEATURE CARDS COMPONENT
───────────────────────────────────────── */

export function FeatureCards() {
  const shouldReduceMotion = useReducedMotion();

  // Static render for reduced motion
  if (shouldReduceMotion) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {valueProps.map((prop) => (
          <ValuePropCard key={prop.title} prop={prop} />
        ))}
      </div>
    );
  }

  // Render both versions - CSS controls which is visible
  // Mobile (< lg): static version (no whileInView animation issues)
  // Desktop (≥ lg): animated version with scroll animations
  return (
    <>
      {/* Static version for mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:hidden">
        {valueProps.map((prop) => (
          <ValuePropCard key={prop.title} prop={prop} />
        ))}
      </div>

      {/* Animated version for desktop */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="hidden lg:grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {valueProps.map((prop) => (
          <motion.div key={prop.title} variants={itemVariants}>
            <ValuePropCard prop={prop} />
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}

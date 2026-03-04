"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  className?: string;
  delay?: number;
}

export function StatCard({ icon, value, label, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "glass-card-hover p-6 flex flex-col items-center justify-center gap-2",
        className
      )}
    >
      <div className="text-accent text-2xl">{icon}</div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.2 }}
        className="stat-value"
      >
        {value}
      </motion.div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}

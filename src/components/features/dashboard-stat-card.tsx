"use client";

import { Card, CardContent } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/ui/animated-number'

type DashboardStatCardProps = {
  label: string
  value: string
  sublabel?: string
  /** If provided, animates the number from 0 to this value */
  animatedValue?: number
}

/**
 * Simple stat card for dashboard grids.
 * Displays a label, value, and optional sublabel.
 * Use `animatedValue` to enable counting animation for numeric values.
 */
export function DashboardStatCard({ label, value, sublabel, animatedValue }: DashboardStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sublabel text-sm text-text-2 mb-1">{label}</p>
        {animatedValue !== undefined ? (
          <AnimatedNumber 
            value={animatedValue} 
            className="text-stat text-text-1"
          />
        ) : (
          <p className="text-stat text-text-1">{value}</p>
        )}
        {sublabel && (
          <p className="text-mono-sm text-text-2 mt-1">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

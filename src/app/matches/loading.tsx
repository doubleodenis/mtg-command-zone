import { Skeleton, SkeletonMatchCard } from "@/components/ui/skeleton";

export default function MatchesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="text" width={220} height={16} />
        </div>
        <Skeleton variant="rectangular" width={100} height={36} className="rounded-md" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton variant="rectangular" width={100} height={32} className="rounded-md" />
        <Skeleton variant="rectangular" width={100} height={32} className="rounded-md" />
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {/* Date Group */}
        <div className="space-y-3">
          <Skeleton variant="text" width={120} height={14} />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonMatchCard key={i} />
          ))}
        </div>

        {/* Another Date Group */}
        <div className="space-y-3">
          <Skeleton variant="text" width={100} height={14} />
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonMatchCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

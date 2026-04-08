import { Skeleton } from "@/components/ui/skeleton";

function SkeletonLeaderboardRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-card-border last:border-b-0">
      {/* Rank */}
      <Skeleton variant="text" width={24} height={20} />
      {/* Avatar */}
      <Skeleton variant="circular" width={32} height={32} />
      {/* Name & stats */}
      <div className="flex-1 space-y-1">
        <Skeleton variant="text" width={120} height={16} />
        <Skeleton variant="text" width={80} height={12} />
      </div>
      {/* Win rate */}
      <Skeleton variant="text" width={60} height={16} />
      {/* Rating */}
      <Skeleton variant="text" width={48} height={20} />
    </div>
  );
}

export default function LeaderboardsLoading() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="text" width={300} height={16} className="mt-2" />
      </div>

      {/* Leaderboard card */}
      <div className="rounded-lg bg-card border border-card-border overflow-hidden">
        {/* Format tabs */}
        <div className="flex gap-1 px-4 py-3 border-b border-card-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" width={70} height={32} className="rounded-md" />
          ))}
        </div>

        {/* Entries */}
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonLeaderboardRow key={i} />
        ))}
      </div>
    </main>
  );
}

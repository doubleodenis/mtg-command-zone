import { Skeleton, SkeletonStatCard, SkeletonMatchCard } from "@/components/ui/skeleton";

export default function CollectionDetailLoading() {
  return (
    <div className="space-y-8">
      {/* Collection Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
          </div>
          <Skeleton variant="text" width={300} height={16} />
          {/* Stats */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" width={16} height={16} />
              <Skeleton variant="text" width={80} height={14} />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" width={16} height={16} />
              <Skeleton variant="text" width={80} height={14} />
            </div>
          </div>
        </div>
        <Skeleton variant="rectangular" width={100} height={36} className="rounded-md" />
      </div>

      {/* Member Avatars */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="circular" width={40} height={40} />
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Matches */}
          <div className="space-y-3">
            <Skeleton variant="text" width={140} height={14} />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonMatchCard key={i} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Leaderboard */}
          <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
            <Skeleton variant="text" width={100} height={16} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="text" width={20} height={16} />
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" className="flex-1" height={14} />
                <Skeleton variant="text" width={40} height={14} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

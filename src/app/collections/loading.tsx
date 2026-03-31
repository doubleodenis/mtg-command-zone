import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCollectionCard() {
  return (
    <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={140} height={18} />
          <Skeleton variant="text" width={200} height={14} />
        </div>
        <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width={70} height={14} />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width={60} height={14} />
        </div>
      </div>

      {/* Members avatars */}
      <div className="flex items-center -space-x-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="circular" width={28} height={28} />
        ))}
      </div>
    </div>
  );
}

export default function CollectionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={180} height={28} />
          <Skeleton variant="text" width={260} height={16} />
        </div>
        <Skeleton variant="rectangular" width={130} height={36} className="rounded-md" />
      </div>

      {/* Collection Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCollectionCard key={i} />
        ))}
      </div>
    </div>
  );
}

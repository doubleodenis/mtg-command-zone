import { Skeleton } from "@/components/ui/skeleton";

function SkeletonDeckCard() {
  return (
    <div className="rounded-lg bg-card border border-card-border overflow-hidden">
      {/* Color bar */}
      <Skeleton variant="rectangular" className="h-1.5 w-full" />
      
      <div className="p-4 space-y-4">
        {/* Commander info */}
        <div className="flex items-start gap-3">
          <Skeleton variant="rectangular" width={40} height={40} className="rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width={140} height={16} />
            <Skeleton variant="text" width={100} height={14} />
          </div>
          <Skeleton variant="rectangular" width={24} height={24} className="rounded-full" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Skeleton variant="text" width={60} height={14} />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton variant="text" width={50} height={14} />
          </div>
        </div>

        {/* Win rate bar */}
        <Skeleton variant="rectangular" className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

export default function DecksLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={140} height={28} />
          <Skeleton variant="text" width={320} height={16} />
        </div>
        <Skeleton variant="rectangular" width={100} height={36} className="rounded-md" />
      </div>

      {/* Active Decks Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width={100} height={14} />
          <Skeleton variant="rectangular" width={24} height={20} className="rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonDeckCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

function SkeletonFriendRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-1">
        <Skeleton variant="text" width={120} height={16} />
        <Skeleton variant="text" width={80} height={12} />
      </div>
      <Skeleton variant="rectangular" width={80} height={32} className="rounded-md" />
    </div>
  );
}

export default function FriendsLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={100} height={28} />
          <Skeleton variant="text" width={240} height={16} />
        </div>
        <Skeleton variant="rectangular" width={110} height={36} className="rounded-md" />
      </div>

      {/* Friends List Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width={140} height={14} />
        </div>
        
        <div className="rounded-lg bg-card border border-card-border overflow-hidden">
          <div className="divide-y divide-card-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonFriendRow key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

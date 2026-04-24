'use client'

// ====== Reusable Skeleton Loading Components ======

/** Skeleton placeholder with shimmer pulse animation */
function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />
}

/** Skeleton for a room list item (avatar + text lines) */
export function RoomItemSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl animate-fade-in">
      <SkeletonPulse className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonPulse className="h-3.5 w-3/4 rounded-md" />
        <SkeletonPulse className="h-2.5 w-1/2 rounded-md" />
      </div>
      <SkeletonPulse className="h-2.5 w-2.5 rounded-full flex-shrink-0" />
    </div>
  )
}

/** Skeleton for multiple room list items */
export function RoomListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-1 px-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 80}ms` }}>
          <RoomItemSkeleton />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for a message bubble */
function MessageBubbleSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex gap-2.5 px-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && <SkeletonPulse className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />}
      <div className={`max-w-[65%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <SkeletonPulse className={`h-14 ${isOwn ? 'w-48' : 'w-56'} rounded-2xl ${isOwn ? 'rounded-br-lg' : 'rounded-bl-lg'}`} />
        <SkeletonPulse className="h-2 w-12 rounded-full" />
      </div>
    </div>
  )
}

/** Skeleton for multiple message bubbles */
export function MessageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="py-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-message-appear"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <MessageBubbleSkeleton isOwn={i % 3 === 2} />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for chat area header */
export function ChatHeaderSkeleton() {
  return (
    <div className="h-14 border-b border-border/20 px-4 flex items-center gap-3 glass-header">
      <SkeletonPulse className="h-9 w-9 rounded-xl" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-3.5 w-32 rounded-md" />
        <SkeletonPulse className="h-2 w-16 rounded-md" />
      </div>
    </div>
  )
}

/** Full chat area skeleton (header + messages) */
export function ChatAreaSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <ChatHeaderSkeleton />
      <div className="flex-1">
        <MessageListSkeleton count={6} />
      </div>
    </div>
  )
}

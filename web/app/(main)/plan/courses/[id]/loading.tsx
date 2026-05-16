export default function Loading() {
  return (
    <div className="px-3 py-3 max-w-lg mx-auto animate-pulse space-y-3">
      <div className="h-[28px] w-[60%] rounded bg-trail-surface" />
      <div className="h-[14px] w-[40%] rounded bg-trail-surface" />
      <div className="h-[120px] rounded-[12px] bg-trail-surface" />
      <div className="h-[80px] rounded-[12px] bg-trail-surface" />
    </div>
  )
}

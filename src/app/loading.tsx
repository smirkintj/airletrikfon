// Same footprint as the overview so nothing jumps when data arrives.
export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="skeleton h-56 border border-line" />
        <div className="skeleton h-56 border border-line" />
      </div>
      <div className="skeleton h-[28rem] border border-line" />
    </div>
  );
}

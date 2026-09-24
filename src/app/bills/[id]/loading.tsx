export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-20 w-2/3 max-w-md" />
      <div className="skeleton h-40 border border-line" />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="skeleton h-80 border border-line" />
        <div className="skeleton h-80 border border-line" />
      </div>
    </div>
  );
}

export default function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-shimmer block rounded-md bg-white/10 ${className}`} />;
}

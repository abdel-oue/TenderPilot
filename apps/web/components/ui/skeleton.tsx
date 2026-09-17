import { cn } from "@/lib/utils/classNameUtils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-soft", className)} aria-hidden="true" />;
}

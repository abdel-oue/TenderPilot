import { cn } from "@/lib/utils/classNameUtils";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

// Uppercase label with the leading rule, used above every section title.
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "mb-6 flex items-center gap-2.5 text-micro font-semibold tracking-label text-muted uppercase sm:text-tiny",
        "before:h-px before:w-5.5 before:bg-current before:content-['']",
        className,
      )}
    >
      {children}
    </p>
  );
}

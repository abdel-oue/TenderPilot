import { cn } from "@/lib/utils/classNameUtils";

interface ContainerProps {
  children: React.ReactNode;
  as?: "div" | "nav" | "section";
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

// 1184px of content with the design's 16/20/32px gutters.
export function Container({ children, as: Tag = "div", className, ...rest }: ContainerProps) {
  return (
    <Tag
      className={cn("mx-auto w-full max-w-page px-4 sm:px-5 md:px-8", className)}
      aria-label={rest["aria-label"]}
      data-testid={rest["data-testid"]}
    >
      {children}
    </Tag>
  );
}

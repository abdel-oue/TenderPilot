import { cn } from "@/lib/utils/classNameUtils";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  href?: string;
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

const BASE =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-md border border-border bg-transparent px-6 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-px hover:bg-soft";
const PRIMARY = "border-foreground bg-foreground text-background hover:bg-foreground hover:opacity-90";

export function Button({ children, variant = "secondary", href, onClick, className, ...rest }: ButtonProps) {
  const classes = cn(BASE, variant === "primary" && PRIMARY, className);
  if (href) {
    return (
      <a className={classes} href={href} onClick={onClick} data-testid={rest["data-testid"]}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} onClick={onClick} data-testid={rest["data-testid"]}>
      {children}
    </button>
  );
}

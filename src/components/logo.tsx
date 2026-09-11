import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" className="text-surface-2" />
      <rect x="7" y="13" width="2.4" height="6" rx="1.2" className="fill-accent" />
      <rect x="11.2" y="9" width="2.4" height="14" rx="1.2" className="fill-accent" />
      <rect x="15.4" y="7" width="2.4" height="18" rx="1.2" className="fill-accent" />
      <rect x="19.6" y="11" width="2.4" height="10" rx="1.2" className="fill-accent" />
      <rect x="23.8" y="14" width="2.4" height="4" rx="1.2" className="fill-accent" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className="font-display text-lg font-medium tracking-tight text-fg">
        VozClara
      </span>
    </span>
  );
}

import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

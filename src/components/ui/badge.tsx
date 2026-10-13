import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-blue-600 text-white shadow-xs",
        secondary:
          "border border-transparent bg-slate-100 text-slate-800",
        destructive:
          "border border-transparent bg-rose-50 text-rose-700 border-rose-200",
        outline: "border border-slate-200 text-slate-700",
        success:
          "border border-emerald-200 bg-emerald-50 text-emerald-700",
        inactive:
          "border border-slate-200 bg-slate-100 text-slate-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };


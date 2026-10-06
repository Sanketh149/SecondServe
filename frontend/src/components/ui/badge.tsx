import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva("ui-badge", {
  variants: {
    variant: {
      default: "ui-badge--brand",
      neutral: "ui-badge--neutral",
      success: "ui-badge--success",
      warning: "ui-badge--warning",
      danger: "ui-badge--danger",
      outline: "ui-badge--outline",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }

/**
 * @deprecated Use F1Card from @/components/f1 with variant="glass" instead.
 * This file re-exports F1Card for backward compatibility and will be removed in a future version.
 */
import * as React from "react";
import {
  F1Card,
  F1CardHeader,
  F1CardTitle,
  F1CardDescription,
  F1CardContent,
  F1CardFooter,
  f1CardVariants,
  type F1CardSize,
  type F1CardGlassVariant,
} from "@/components/f1";

export type GlassCardProps = React.ComponentProps<typeof F1Card> & {
  variant?: "default" | "glow" | "panel" | "subtle";
  size?: F1CardSize;
  hover?: React.ComponentProps<typeof F1Card>["hover"];
  accent?: React.ComponentProps<typeof F1Card>["accent"];
};

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (props, ref) => {
    const { variant = "default", ...rest } = props;
    return (
      <F1Card
        ref={ref}
        variant="glass"
        glassVariant={variant as F1CardGlassVariant}
        {...rest}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";

export {
  GlassCard,
  F1CardHeader as GlassCardHeader,
  F1CardTitle as GlassCardTitle,
  F1CardDescription as GlassCardDescription,
  F1CardContent as GlassCardContent,
  F1CardFooter as GlassCardFooter,
  f1CardVariants as glassCardVariants,
};

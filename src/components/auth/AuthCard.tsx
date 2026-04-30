import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardFooter,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
import { useCardSurface } from "@/hooks/useCardSurface";
import f1Logo from "@/assets/f1-logo.svg";

interface AuthCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Footer content (link to other auth page, etc.). */
  footer?: React.ReactNode;
  /** Optional content rendered above the card (badges, etc.). */
  topSlot?: React.ReactNode;
  /** Show "Return to Dashboard" link at top. Default true. */
  showBackLink?: boolean;
  /** Show F1 logo above title. Default true. */
  showLogo?: boolean;
  className?: string;
}

/**
 * Shared scaffolding for all auth pages (login, signup, reset password, etc.).
 * Centralizes layout, card surface, logo, back link, and footer presentation.
 */
const AuthCard: React.FC<AuthCardProps> = ({
  title,
  description,
  children,
  footer,
  topSlot,
  showBackLink = true,
  showLogo = true,
  className,
}) => {
  const { variant, glassVariant, isGlass } = useCardSurface();

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md">
        {showBackLink && (
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Link>
          </div>
        )}

        {topSlot && <div className="mb-6 flex justify-center">{topSlot}</div>}

        <F1Card
          variant={variant}
          glassVariant={glassVariant}
          className={cn("w-full p-0", isGlass && "border-white/10", className)}
        >
          <F1CardHeader className="space-y-1 text-center">
            {showLogo && (
              <div className="flex justify-center mb-4">
                <img src={f1Logo} alt="F1 DataStop" className="w-16 h-16" />
              </div>
            )}
            <F1CardTitle className="!text-2xl justify-center">{title}</F1CardTitle>
            {description && (
              <F1CardDescription className="text-muted-foreground">
                {description}
              </F1CardDescription>
            )}
          </F1CardHeader>
          <F1CardContent>{children}</F1CardContent>
          {footer && (
            <F1CardFooter className="flex justify-center border-t-0 pt-2">
              {footer}
            </F1CardFooter>
          )}
        </F1Card>
      </div>
    </div>
  );
};

export { AuthCard };
export default AuthCard;

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

const GlassModal = DialogPrimitive.Root;

const GlassModalTrigger = DialogPrimitive.Trigger;

const GlassModalPortal = DialogPrimitive.Portal;

const GlassModalClose = DialogPrimitive.Close;

const GlassModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 glass-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
GlassModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

const glassModalContentVariants = cva(
  "fixed z-50 grid w-full gap-4 glass-modal p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  {
    variants: {
      position: {
        center:
          "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        top: "left-[50%] top-4 translate-x-[-50%] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "left-[50%] bottom-4 translate-x-[-50%] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
      size: {
        sm: "max-w-sm rounded-xl",
        default: "max-w-lg rounded-xl",
        lg: "max-w-2xl rounded-xl",
        xl: "max-w-4xl rounded-2xl",
        full: "max-w-[95vw] max-h-[95vh] rounded-2xl",
        fullscreen: "w-screen h-screen max-w-none rounded-none",
      },
    },
    defaultVariants: {
      position: "center",
      size: "default",
    },
  }
);

export interface GlassModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof glassModalContentVariants> {
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether to close on overlay click */
  closeOnOverlayClick?: boolean;
}

const GlassModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  GlassModalContentProps
>(
  (
    {
      className,
      children,
      position,
      size,
      showCloseButton = true,
      closeOnOverlayClick = true,
      ...props
    },
    ref
  ) => (
    <GlassModalPortal>
      <GlassModalOverlay
        onClick={closeOnOverlayClick ? undefined : (e) => e.preventDefault()}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(glassModalContentVariants({ position, size }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </GlassModalPortal>
  )
);
GlassModalContent.displayName = DialogPrimitive.Content.displayName;

const GlassModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
GlassModalHeader.displayName = "GlassModalHeader";

const GlassModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
GlassModalFooter.displayName = "GlassModalFooter";

const GlassModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
GlassModalTitle.displayName = DialogPrimitive.Title.displayName;

const GlassModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
GlassModalDescription.displayName = DialogPrimitive.Description.displayName;

export {
  GlassModal,
  GlassModalPortal,
  GlassModalOverlay,
  GlassModalClose,
  GlassModalTrigger,
  GlassModalContent,
  GlassModalHeader,
  GlassModalFooter,
  GlassModalTitle,
  GlassModalDescription,
  glassModalContentVariants,
};


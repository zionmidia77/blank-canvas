import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:animate-[scale-in_0.2s_ease-out]",
          success:
            "group-[.toaster]:!border-success/30 group-[.toaster]:!shadow-[0_0_16px_-4px_hsl(142_71%_45%/0.3)]",
          error:
            "group-[.toaster]:!border-destructive/30 group-[.toaster]:!shadow-[0_0_16px_-4px_hsl(0_84%_60%/0.3)] group-[.toaster]:animate-[shake_0.4s_ease-out]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

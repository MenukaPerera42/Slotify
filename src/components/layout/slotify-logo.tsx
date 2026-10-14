import Image from "next/image";
import { cn } from "@/lib/utils";

interface SlotifyLogoProps {
  className?: string;
  priority?: boolean;
  variant?: "cropped" | "original" | "icon";
}

export function SlotifyLogo({
  className,
  priority = false,
  variant = "cropped",
}: SlotifyLogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src="/icons/slotify-icon.png"
        alt="Slotify"
        width={512}
        height={512}
        priority={priority}
        className={cn("h-auto w-auto object-contain", className)}
      />
    );
  }

  if (variant === "original") {
    return (
      <Image
        src="/branding/slotify-logo-original.png"
        alt="Slotify"
        width={2048}
        height={682}
        priority={priority}
        className={cn("h-auto object-contain", className)}
      />
    );
  }

  // Official cropped horizontal logo (trimmed excess transparent margins)
  return (
    <Image
      src="/branding/slotify-logo.png"
      alt="Slotify"
      width={1585}
      height={440}
      priority={priority}
      className={cn("h-auto object-contain", className)}
    />
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

interface SlotifyIconProps {
  className?: string;
  size?: number;
  priority?: boolean;
}

export function SlotifyIcon({
  className,
  size = 512,
  priority = false,
}: SlotifyIconProps) {
  return (
    <Image
      src="/icons/slotify-icon.png"
      alt="Slotify"
      width={size}
      height={size}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}


import Image from "next/image";
import { cn } from "@/lib/utils";

export function SlotifyLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return <Image
    src="/logo.png"
    alt="Slotify"
    width={2172}
    height={724}
    priority={priority}
    className={cn("h-auto object-contain", className)}
  />;
}

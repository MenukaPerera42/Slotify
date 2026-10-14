import Image from "next/image";

export function AuthArtPanel() {
  return (
    <div className="w-full h-full flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16 select-none pointer-events-none">
      <div className="relative w-full max-w-[460px] lg:max-w-[520px] xl:max-w-[580px] aspect-square flex items-center justify-center">
        <Image
          src="/login page.png"
          alt="Slotify Workspace Management Illustration"
          width={2000}
          height={2000}
          priority
          className="w-full h-auto object-contain max-h-[82vh]"
        />
      </div>
    </div>
  );
}

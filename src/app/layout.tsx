import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slotify — Resource Reservation Management System",
  description:
    "PrimeWave Lab Software Engineering Internship Technical Assessment: Enterprise resource organization, reservation management, availability tracking, and conflict prevention.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#f6f7fb] text-[#111827]">
        {children}
      </body>
    </html>
  );
}

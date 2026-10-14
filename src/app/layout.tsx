import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slotify — Resource Reservation Management System",
  description:
    "PrimeWave Lab Software Engineering Internship Technical Assessment: Enterprise resource organization, reservation management, availability tracking, and conflict prevention.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
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

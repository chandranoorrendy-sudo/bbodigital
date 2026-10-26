import type { Metadata, Viewport } from "next";
import { Amiri, Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const amiri = Amiri({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "BBO Digital · Kuttab Imam Al-Ghazali",
  description: "Belajar Bersama Orang Tua — Kuttab Imam Al-Ghazali, Sukabumi",
  applicationName: "BBO Kuttab",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14532d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${geist.variable} ${amiri.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}

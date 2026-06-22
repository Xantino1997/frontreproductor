import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import UpdateBaner from "./components/Player/UpdateBaner";
import BotonDescarga from "./components/Player/BotonDescarga";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DJ Console",
  description: "Reproductor multimedia DJ Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <UpdateBaner />
      </body>
    </html>
  );
}
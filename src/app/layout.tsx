import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RepositoryProvider } from "@/infrastructure/providers/RepositoryProvider";
import { ToastProvider } from "@/shared/components/Toast";
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
  title: "OmniRetail | Frontend Base",
  description: "Proyecto base del frontend web de OmniRetail.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <RepositoryProvider>
          <ToastProvider>{children}</ToastProvider>
        </RepositoryProvider>
      </body>
    </html>
  );
}

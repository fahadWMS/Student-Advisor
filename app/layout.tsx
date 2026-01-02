import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/SessionProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Student Consultation Assistant",
  description: "Your personal AI advisor for academic, career, and wellness guidance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeToggle floating />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata = {
  title: "ClauseAI",
  description: "AI infrastructure intelligence for startups",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen antialiased ${inter.variable} ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppShell } from "./components/app-shell";
import { LearnerProvider } from "./components/learner-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CodeX",
    template: "%s | CodeX",
  },
  description: "Practice coding problems and learn from every evaluated attempt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <LearnerProvider>
          <AppShell>{children}</AppShell>
        </LearnerProvider>
      </body>
    </html>
  );
}

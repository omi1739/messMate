import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "MessMate - Mess Management Dashboard",
  description: "Modern desktop mess and shared apartment management system.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
        <Sidebar />
        <main className="flex-1 pl-64 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}

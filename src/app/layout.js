import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { themeScript } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata = {
  title: {
    default: "MessMate — Run your mess without the spreadsheet",
    template: "%s · MessMate",
  },
  description:
    "MessMate handles bazar costs, seat rent, utility bills and daily meals for a shared mess, then works out exactly who owes what — every month, automatically.",
  applicationName: "MessMate",
  keywords: ["mess management", "mess calculator", "bazar cost", "meal tracking", "seat rent"],
  openGraph: {
    title: "MessMate — Run your mess without the spreadsheet",
    description:
      "Track bazar, seat rent, utilities and daily meals. Get an automatic monthly settlement your members can actually understand.",
    type: "website",
  },
};

export const viewport = {
  // Derived from the OKLCH values in globals.css: light --background and dark
  // --background. Kept in step by check-contrast.mjs.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1212" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        {/* Applies the saved theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

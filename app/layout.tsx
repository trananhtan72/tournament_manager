import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

// The app's UI font (see globals.css's --font-sans). Geist Sans stays loaded
// too, purely for the court scoreboard's own always-black TV display, which
// opts into it explicitly rather than following the app's theme.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Tournament Manager", template: "%s · Tournament Manager" },
  description: "Badminton tournament management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavBar />
        {/* No width cap here: most pages (public tournament pages, a player's
            dashboard, sign-in forms) read best at a narrow, centered column
            and set that themselves; the organizer console instead opts into
            a wide one (see app/organizer/layout.tsx) — it's a desktop data
            tool, not a page meant to be read top to bottom. */}
        <main className="w-full flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

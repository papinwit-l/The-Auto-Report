import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto Report",
  description: "Internal ad reporting tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased font-sans">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
            <a
              href="/"
              className="text-sm font-semibold tracking-wide uppercase text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Auto Report
            </a>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

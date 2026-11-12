import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import SearchShortcut from "./SearchShortcut";
import ToastHost from "./components/ToastHost";

export const metadata: Metadata = {
  title: "AI Experiment Studio",
  description: "A private workspace for AI experiments, prompts, and model evaluation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><SearchShortcut /><ToastHost />{children}</body>
    </html>
  );
}

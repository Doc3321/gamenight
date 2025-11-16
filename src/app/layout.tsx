import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Toaster } from "sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "סוכן - משחק המילים",
  description: "משחק מילים חברתי ומהנה - מצא את המתחזה או המילה הדומה!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasValidClerkKey = clerkPublishableKey && clerkPublishableKey.startsWith('pk_');

  const content = (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body
        className={`${heebo.variable} font-hebrew antialiased`}
      >
        <ThemeProvider defaultTheme="system" storageKey="soken-theme">
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );

  if (hasValidClerkKey) {
    return <ClerkProvider publishableKey={clerkPublishableKey}>{content}</ClerkProvider>;
  }

  // During build or when Clerk is not configured, render without ClerkProvider
  return content;
}
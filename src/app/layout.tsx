import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignSeal",
  description: "Client approvals with a tamper-evident audit trail",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

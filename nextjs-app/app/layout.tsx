import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "yusteven",
  description: "实时监控系统日志和图像查看器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>
        {children}
      </body>
    </html>
  );
}

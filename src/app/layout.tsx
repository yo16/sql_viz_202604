import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-2RGNVSTMYN";
const SITE_URL = "https://sql-viz.com";
const SITE_TITLE = "SQL Lineage Viz - SQLカラムリネージュ可視化ツール";
const SITE_DESCRIPTION =
  "SQLのカラムレベルのリネージュをインタラクティブなグラフで可視化。SELECT文を貼り付けるだけで、テーブル間のカラム依存関係を自動解析し、データフローを直感的に把握できます。";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "SQL Lineage Viz",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SQL Lineage Viz - SQLカラムリネージュ可視化ツール",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  keywords: [
    "SQL",
    "リネージュ",
    "lineage",
    "カラムリネージュ",
    "データフロー",
    "可視化",
    "データリネージュ",
    "SQL解析",
    "テーブル依存関係",
    "data lineage",
    "column lineage",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "SQL Lineage Viz",
              "url": SITE_URL,
              "description": SITE_DESCRIPTION,
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "All",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "JPY",
              },
              "provider": {
                "@type": "Organization",
                "name": "Small Piece",
                "url": "https://smallpiece.jp/",
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}

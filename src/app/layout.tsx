import type { Metadata } from "next";
import Script from "next/script";
import { LocaleBootstrap } from "@/components/LocaleBootstrap";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-2RGNVSTMYN";
const SITE_URL = "https://sql-viz.com";

/**
 * FOUC 防止インラインスクリプト。
 *
 * HTML パース中に同期実行され、React レンダリング前に `<html lang>` を確定させる。
 * 優先順位 (doc/design/i18n.md §3.1):
 *   1. localStorage['sql-viz-locale'] が 'ja' または 'en' → その値
 *   2. navigator.language が 'ja' で始まる → 'ja'、それ以外 → 'en'
 *   3. navigator 未取得時 → 'ja' (NAVIGATOR_UNAVAILABLE_FALLBACK)
 *
 * `resolveInitialLocale()` と同一の優先順位ロジック（二重実装、設計 §3.3）。
 * SSR は `<html lang="en">` 固定なので、確定値が 'ja' のときのみ書き換える。
 */
const LOCALE_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('sql-viz-locale');
    var locale = (saved === 'ja' || saved === 'en') ? saved
      : (navigator.language && navigator.language.toLowerCase().startsWith('ja') ? 'ja'
        : (navigator.language ? 'en' : 'ja'));
    if (locale === 'ja') {
      document.documentElement.setAttribute('lang', 'ja');
    }
  } catch(e) {}
})();
`.trim();
const SITE_TITLE = "SQL Lineage Viz - SQL Column Lineage Visualization Tool";
const SITE_DESCRIPTION =
  "Visualize SQL column-level lineage on an interactive graph. Just paste your SELECT statements and the tool automatically analyzes table-to-table column dependencies, helping you understand data flow at a glance.";

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
        alt: "SQL Lineage Viz - SQL Column Lineage Visualization Tool",
      },
    ],
    locale: "en_US",
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
    "lineage",
    "column lineage",
    "data lineage",
    "data flow",
    "visualization",
    "SQL analysis",
    "table dependencies",
    "DWH",
    "data warehouse",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          id="locale-init"
          dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }}
        />
        <LocaleBootstrap />
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
                "priceCurrency": "USD",
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

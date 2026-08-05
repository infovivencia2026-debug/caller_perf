import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* Kept for tabular figures only — phone numbers, durations and the call clock stay
   monospaced so columns of digits line up. Applied via the `.nums` helper and
   Tailwind's `font-mono`, never to body text. */
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Counsellor Performance",
  description: "Counsellor call logging and performance tracking",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Counsellor", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

/**
 * viewportFit: "cover" plus the safe-area padding in globals.css keeps the sticky save
 * bar clear of the home indicator when the app is installed to a home screen.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f6" },
    { media: "(prefers-color-scheme: dark)", color: "#08080a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <head>
        {/* Apply the saved appearance before first paint (default light) so there's no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          Ticks the live call timer on the calling screen. It lives here, in the initial
          document, because a <script> that React inserts during a client-side navigation
          never executes — the browser only runs inline scripts present at parse time.
          It polls for the element each second so it keeps working after React swaps the
          DOM, and it is plain DOM rather than React state so a hydration failure cannot
          freeze it. When the element is absent (every other page) each tick is a no-op.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function p(n){return n<10?'0'+n:''+n}setInterval(function(){var el=document.getElementById('call-elapsed');if(el){var s=el.getAttribute('data-started-at');if(s){var t=new Date(s).getTime();if(!isNaN(t)){var d=Math.max(0,Math.round((Date.now()-t)/1000));var x=Math.floor(d/60)+'m '+p(d%60)+'s';if(el.textContent!==x)el.textContent=x}}}var now=document.getElementById('call-now');if(now){var y=new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});if(now.textContent!==y)now.textContent=y}},1000)})();`,
          }}
        />
      </body>
    </html>
  );
}

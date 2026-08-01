import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Telecaller Performance",
  description: "Telecaller call logging and performance tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
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

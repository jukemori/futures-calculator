import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Futures Risk + Runner TP Calculator',
  description:
    'Size micro futures by risk, then solve the runner take-profit that holds a target blended RR after a partial — with honest outcome math.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c10' },
  ],
};

// Runs before first paint to apply the persisted theme (default: light),
// avoiding a flash of the wrong theme under static export.
const noFlashTheme = `try{var s=JSON.parse(localStorage.getItem('futures-calculator:v1')||'{}');if(s.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

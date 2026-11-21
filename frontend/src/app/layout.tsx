import './../styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import ThreeBackground from '@/components/ThreeBackground';
import ThemeToggle from '@/components/ThemeToggle';

// Runs before first paint so there's no dark→light flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export const metadata = {
  title: 'Clipboard Cloud — instant cross-device clipboard sync',
  description:
    'Pair two devices with a QR code or 6-digit code and sync your clipboard instantly. No login required.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Clipboard Cloud',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThreeBackground />
        <AuthProvider>{children}</AuthProvider>
        <ThemeToggle />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

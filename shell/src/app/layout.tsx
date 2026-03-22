import type { Metadata } from 'next';
import './globals.css';
import '@/components/editor/editor-styles.css';
import { Providers } from './providers';
import { Inter, Allura } from 'next/font/google';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const allura = Allura({ weight: '400', subsets: ['latin'], variable: '--font-allura' });

export const metadata: Metadata = {
  title: 'ASuite',
  description: 'Human-Agent Workspace',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ASuite',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${allura.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

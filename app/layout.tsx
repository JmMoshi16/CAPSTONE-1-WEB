import './globals.css';
import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/AuthContext';

// Self-hosted at build time instead of a render-blocking CSS @import (audit M-10).
// The same pair as the kiosk and the phone app: Fraunces for titles and figures, DM Sans for the rest.
const body = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-body' });
const display = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-display', axes: ['SOFT', 'opsz'] });

export const metadata: Metadata = {
  title: 'ECOReward Admin Dashboard',
  description: 'Admin dashboard for ECOReward Bin IoT waste management system',
  robots: { index: false, follow: false }, // private admin console (audit M-05)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1C2520', color: '#F2EDE3', border: '1px solid #2A342D', borderRadius: '14px' },
              success: { iconTheme: { primary: '#7CCFA5', secondary: '#1C2520' } },
              error: { iconTheme: { primary: '#EF5350', secondary: '#1C2520' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/AuthContext';

// Self-hosted at build time instead of a render-blocking CSS @import (audit M-10).
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ECOReward Admin Dashboard',
  description: 'Admin dashboard for ECOReward Bin IoT waste management system',
  robots: { index: false, follow: false }, // private admin console (audit M-05)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#161B22', color: '#fff', border: '1px solid #30363D' },
              success: { iconTheme: { primary: '#00E676', secondary: '#161B22' } },
              error: { iconTheme: { primary: '#EF5350', secondary: '#161B22' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

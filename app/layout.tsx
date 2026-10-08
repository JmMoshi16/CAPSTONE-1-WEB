import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = {
  title: 'ECOReward Admin Dashboard',
  description: 'Admin dashboard for ECOReward Bin IoT waste management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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

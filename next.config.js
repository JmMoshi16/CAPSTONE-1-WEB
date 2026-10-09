/** @type {import('next').NextConfig} */

// Security headers (audit M-05).
// Enforced now: directives that cannot break Next.js or Firebase - no framing (clickjacking of
// "delete reward" / "mark claimed"), no plugins, no <base> or form hijacking.
const enforcedCsp = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Full policy in REPORT-ONLY mode: it restricts where scripts may connect (Firebase only). Open the
// dashboard, sign in, use every page, and check the browser console for "Content-Security-Policy"
// reports; when there are none, rename the header below to `Content-Security-Policy`.
const isDev = process.env.NODE_ENV !== 'production';
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`, // Next.js inline bootstrap scripts
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
  "frame-src https://*.firebaseapp.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: enforcedCsp },
  { key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  reactStrictMode: true,
  // The browser-test build (npm run e2e) goes to its own folder so it never replaces the real build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    // Scan History used to live at /qr (audit M-01).
    return [{ source: '/qr', destination: '/scan-history', permanent: false }];
  },
};

module.exports = nextConfig;

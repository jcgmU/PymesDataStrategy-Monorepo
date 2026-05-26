import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* ws://localhost:* http://api:3000",
      "frame-ancestors 'none'",
    ].join('; ')
  }
]

const nextConfig: NextConfig = {
  async headers() {
    const apiPublicUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const headers = securityHeaders.map((h) => {
      if (h.key === 'Content-Security-Policy') {
        return {
          ...h,
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            `connect-src 'self' ${apiPublicUrl} ws://localhost:*`,
            "frame-ancestors 'none'",
          ].join('; '),
        }
      }
      return h
    })
    return [{ source: '/:path*', headers }]
  },
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000'
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig

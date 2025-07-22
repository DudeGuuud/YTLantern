/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: (process.env.BACKEND_URL || 'http://backend:8000') + '/:path*',
      },
    ]
  },
  images: {
    domains: ['img.youtube.com', 'i.ytimg.com'],
  },
}

module.exports = nextConfig

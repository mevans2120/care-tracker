/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['caretracker.com'],
  },
  experimental: {
    typedRoutes: true,
  }
};

module.exports = nextConfig;
// Force complete redeployment - cache bust all endpoints - 2025-06-25 07:17
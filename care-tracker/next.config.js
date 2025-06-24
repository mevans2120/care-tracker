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
// Trigger deployment - 2025-06-23 17:04
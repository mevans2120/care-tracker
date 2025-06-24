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
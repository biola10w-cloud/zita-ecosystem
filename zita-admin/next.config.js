/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { domains: ['cdn.zita.app'] },
};

module.exports = nextConfig;


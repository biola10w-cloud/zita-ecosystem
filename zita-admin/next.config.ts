import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { domains: ['cdn.zita.app'] },
};
export default nextConfig;

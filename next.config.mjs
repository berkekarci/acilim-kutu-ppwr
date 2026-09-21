/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/admin", destination: "/yonetici" },
      { source: "/admin/:path*", destination: "/yonetici/:path*" },
    ];
  },
};

export default nextConfig;

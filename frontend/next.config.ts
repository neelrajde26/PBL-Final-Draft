import type { NextConfig } from "next";

const backendUrl = (process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

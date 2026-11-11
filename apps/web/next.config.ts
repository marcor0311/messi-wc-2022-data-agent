import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.goal.com", pathname: "/images/v3/blt71b60bc73eb28501/**" },
      { protocol: "https", hostname: "d3b5jqy5xuub7g.cloudfront.net", pathname: "/wp-content/uploads/2024/06/**" },
    ],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_URL || "http://127.0.0.1:8000"}/api/:path*` }];
  },
};

export default nextConfig;

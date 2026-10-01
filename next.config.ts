import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional legacy-.xls parser (SheetJS from its official CDN) is loaded at runtime only if installed.
  serverExternalPackages: ["xlsx"],
  poweredByHeader: false,
};

export default nextConfig;

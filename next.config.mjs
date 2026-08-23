/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Monaco editor loads workers from CDN; keep builds deterministic
  transpilePackages: ["@monaco-editor/react"],
  eslint: {
    // Don't fail production builds on lint warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors are checked in CI; don't block the build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

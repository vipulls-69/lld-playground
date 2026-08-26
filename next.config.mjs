/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repoName = 'lld-playground'; 
const nextConfig = {
  // Required for GitHub Pages
  output: 'export',
  basePath: isProd ? `/${repoName}` : '',
  images: {
    unoptimized: true,
  },

  // Your existing settings
  reactStrictMode: true,
  transpilePackages: ['@monaco-editor/react'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

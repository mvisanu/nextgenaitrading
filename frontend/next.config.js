/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plotly.js requires transpilation for some build targets
  transpilePackages: [],
};

module.exports = nextConfig;

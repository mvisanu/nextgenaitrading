/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plotly.js requires transpilation for some build targets
  transpilePackages: [],
  async redirects() {
    const routes = require("./lib/legacy-routes.json");
    return Object.entries(routes).map(([source, destination]) => ({
      source,
      destination,
      permanent: false,
    }));
  },
};

module.exports = nextConfig;

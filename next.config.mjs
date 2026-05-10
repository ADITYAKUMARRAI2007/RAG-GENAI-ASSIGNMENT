/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "pdfjs-dist",
      "pdf-parse",
    ],
  },
};

export default nextConfig;

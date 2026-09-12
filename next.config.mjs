/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "file-type",
      "pdf-parse",
      "mammoth",
      "jszip",
    ],
  },
};

export default nextConfig;

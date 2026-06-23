/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@distube/ytpl',
    '@distube/ytdl-core',
    'ffmpeg-static',
  ],
};

export default nextConfig;

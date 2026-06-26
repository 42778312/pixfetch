/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@distube/ytpl',
    '@distube/ytdl-core',
    'ffmpeg-static',
  ],
  outputFileTracingIncludes: {
    '/api/info': ['./bin/**/*'],
    '/api/health': ['./bin/**/*'],
    '/api/download': ['./bin/**/*'],
    '/api/download/stream': ['./bin/**/*'],
    '/api/download/file': ['./bin/**/*'],
    '/api/download/status': ['./bin/**/*'],
    '/api/cloud/google-drive': ['./bin/**/*'],
  },
};

export default nextConfig;

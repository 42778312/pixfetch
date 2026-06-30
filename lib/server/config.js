import path from 'path';

export function getSettings() {
  const frontendUrl = (
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');

  return {
    frontendUrl,
    downloadsDir:
      process.env.DOWNLOADS_DIR ||
      path.join(/* turbopackIgnore: true */ process.cwd(), 'downloads'),
    ytdlpPath: process.env.YT_DLP_PATH || '',
  };
}

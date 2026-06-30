export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cleanupOldDownloads } = await import('./lib/server/storage.js');
    cleanupOldDownloads();
  }
}

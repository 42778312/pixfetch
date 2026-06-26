const fs = require('fs');
const path = require('path');

async function main() {
  const binDir = path.join(__dirname, '..', 'bin');
  const isWin = process.platform === 'win32';
  const name = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const dest = path.join(binDir, name);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return;
  }

  fs.mkdirSync(binDir, { recursive: true });

  const url = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  }

  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  if (!isWin) {
    fs.chmodSync(dest, 0o755);
  }

  console.log(`yt-dlp installed to ${dest}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

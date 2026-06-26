const fs = require('fs');
const path = require('path');

function getYtDlpBinaryName() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'linux') return 'yt-dlp_linux';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return 'yt-dlp';
}

function getYtDlpDownloadUrl() {
  if (process.platform === 'win32') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  }
  if (process.platform === 'linux') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  }
  if (process.platform === 'darwin') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
  }
  return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
}

function isPythonScript(filePath) {
  try {
    const head = fs.readFileSync(filePath, { encoding: 'utf8' }).slice(0, 24);
    return head.startsWith('#!');
  } catch {
    return false;
  }
}

async function main() {
  const binDir = path.join(__dirname, '..', 'bin');
  const name = getYtDlpBinaryName();
  const dest = path.join(binDir, name);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    if (process.platform === 'linux' && isPythonScript(dest)) {
      fs.unlinkSync(dest);
    } else {
      return;
    }
  }

  fs.mkdirSync(binDir, { recursive: true });

  const url = getYtDlpDownloadUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  }

  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  if (process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }

  console.log(`yt-dlp installed to ${dest}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

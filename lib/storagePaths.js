const path = require('path');

function isServerlessRuntime() {
  return process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME != null;
}

function getWritableRoot() {
  if (isServerlessRuntime()) {
    return path.join('/tmp', 'pixfetch');
  }
  return process.cwd();
}

function getDownloadsDir() {
  return path.join(getWritableRoot(), 'downloads');
}

function getBinDir() {
  return path.join(getWritableRoot(), 'bin');
}

module.exports = {
  isServerlessRuntime,
  getWritableRoot,
  getDownloadsDir,
  getBinDir,
};

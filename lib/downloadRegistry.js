const activeDownloads = new Map();

function registerDownload(downloadId, cancelFn) {
  activeDownloads.set(downloadId, cancelFn);
}

function unregisterDownload(downloadId) {
  activeDownloads.delete(downloadId);
}

function cancelDownload(downloadId) {
  const cancelFn = activeDownloads.get(downloadId);
  if (cancelFn) {
    cancelFn();
    activeDownloads.delete(downloadId);
    return true;
  }
  return false;
}

module.exports = {
  registerDownload,
  unregisterDownload,
  cancelDownload,
};

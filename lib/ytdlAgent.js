const ytdl = require('@distube/ytdl-core');

let agent = null;

function getYtdlAgent() {
  if (!agent) {
    try {
      agent = ytdl.createAgent();
    } catch {
      agent = undefined;
    }
  }
  return agent;
}

function getYtdlOptions(extra = {}) {
  const options = { ...extra };
  const ytdlAgent = getYtdlAgent();
  if (ytdlAgent) {
    options.agent = ytdlAgent;
  }
  return options;
}

module.exports = {
  getYtdlAgent,
  getYtdlOptions,
};

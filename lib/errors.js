export function mapYoutubeError(error) {
  const message = error?.message || String(error);

  if (/private|unavailable|Video unavailable/i.test(message)) {
    return 'This video is unavailable or private.';
  }
  if (/age|sign in|login|confirm your age/i.test(message)) {
    return 'This video is age-restricted or requires sign-in.';
  }
  if (/copyright|blocked|region/i.test(message)) {
    return 'This video is blocked in your region or for copyright reasons.';
  }
  if (/playlist|not found/i.test(message)) {
    return 'Playlist not found or is private.';
  }
  if (/invalid|could not extract/i.test(message)) {
    return 'Invalid YouTube URL. Please check the link and try again.';
  }
  if (/no playable formats|sign in to confirm|bot/i.test(message)) {
    return 'YouTube blocked this request from the server. Try again, or run PIXFETCH locally for better compatibility.';
  }

  return message;
}

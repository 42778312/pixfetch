# YTDL Pro

A self-hosted YouTube video and playlist downloader built with Next.js 16, `@distube/ytdl-core`, and ffmpeg.

## Features

- Single video download (1080p / 720p / 480p / 360p / MP3)
- Real playlist parsing and batch download with concurrency control
- Fast stream mode — pipe video directly to the browser
- Clip downloads — trim a time range before saving
- Smart URL parsing (Shorts, music.youtube.com, bare video IDs, messy pastes)
- Deep links: open `/?url=<youtube-url>` to auto-analyze
- YouTube bookmarklet (see Settings panel)
- Optional [yt-dlp](https://github.com/yt-dlp/yt-dlp) fallback for reliability

## Requirements

- Node.js 18+
- npm

Bundled via npm:

- `ffmpeg-static` — used for audio conversion and A/V muxing

Optional:

- `yt-dlp` on PATH (or set `YT_DLP_PATH`) — used when ytdl-core fails

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Paste a YouTube URL and click **Analyze**
2. Choose quality (or enable clip mode with start/end times)
3. Click **Download** — fast stream mode pipes directly to your browser; server mode shows progress in the queue

### Deep link from YouTube

Share or open:

```
http://localhost:3000/?url=https://www.youtube.com/watch?v=VIDEO_ID
```

### Bookmarklet

Open **Settings** in the app header and drag the bookmarklet link to your bookmarks bar.

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/info?url=` | Video or playlist metadata |
| `GET /api/download?id=&quality=&taskId=` | SSE server download with progress |
| `DELETE /api/download?taskId=` | Cancel an active download |
| `GET /api/download/stream?id=&quality=&start=&end=` | Direct browser stream |
| `GET /api/download/file?id=&quality=` | Serve completed file from disk |
| `GET /api/health` | ytdl-core / yt-dlp health check |

## Scripts

```bash
npm run dev    # development
npm run build  # production build
npm run start  # production server
npm run lint   # ESLint
```

## Notes

- Downloads are stored in `downloads/` (gitignored) and auto-cleaned after 24 hours
- Public deployment may require rate limiting (enabled on API routes) and has YouTube ToS implications — intended for self-hosted use

## License

MIT
# pixfetch

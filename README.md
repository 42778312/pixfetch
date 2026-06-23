# YTDL Pro

A self-hosted YouTube video and playlist downloader built with Next.js 16, `@distube/ytdl-core`, and ffmpeg.

## Features

- Single video download (1080p / 720p / 480p / 360p / MP3)
- Real playlist parsing and batch download with concurrency control
- Fast stream mode — pipe video directly to the browser
- Clip downloads — trim a time range before saving
- Smart URL parsing (Shorts, music.youtube.com, bare video IDs, messy pastes)
- Deep links and YouTube-style routes (`/watch`, `/v/ID`, `/p/ID`) with optional auto-download
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

Share or open (auto-analyzes; add `&download=1` to start download immediately):

```
http://localhost:3000/?url=https://www.youtube.com/watch?v=VIDEO_ID&download=1&quality=720p
```

### Localhost URL tricks

Change the domain in a YouTube URL from `youtube.com` to `localhost:3000` and keep the path:

```
http://localhost:3000/watch?v=VIDEO_ID
```

Short links:

```
http://localhost:3000/v/VIDEO_ID
http://localhost:3000/p/PLAYLIST_ID
http://localhost:3000/playlist?list=PLAYLIST_ID
```

Add `?quality=1080p` or `?quality=Audio%20Only` to any of the above to override the default 720p.

### Bookmarklet

Open **Settings** in the app header and drag the bookmarklet link to your bookmarks bar. It opens the current YouTube page here and starts a download at your chosen quick-link quality.

### Test checklist (localhost)

1. `http://localhost:3000/watch?v=dQw4w9WgXcQ` — analyze + 720p download starts
2. `http://localhost:3000/v/dQw4w9WgXcQ?quality=1080p` — 1080p download
3. `http://localhost:3000/p/PL0Zuz27SZ-6NS8GXt5nPrcYpust89zq_b` — playlist batch queue
4. Bookmarklet on a YouTube tab — new tab downloads on localhost
5. `watch?v=...&list=...` without `mode` — chooser shown, no auto-download until resolved

Analyze only (no auto-download): `http://localhost:3000/?url=https://www.youtube.com/watch?v=VIDEO_ID`

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

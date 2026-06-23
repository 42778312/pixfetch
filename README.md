# PIXFETCH

A bold, self-hosted YouTube downloader with a retro pixel-art UI. Grab single videos, full playlists, MP3 audio, and trimmed clips — then save locally or straight to **Google Drive**.

![PIXFETCH home screen](docs/screenshot.png)

## Features

### Downloads
- **Single video** — 1080p / 720p / 480p / 360p / MP3
- **Playlist batch download** — parse full playlists and queue with concurrency control
- **Fast stream mode** — pipe video directly to the browser (no server wait)
- **Clip downloads** — trim a start/end time range before saving
- **Resume support** — partial downloads can resume from server or local cache
- **Smart URL parsing** — Shorts, music.youtube.com, bare video IDs, messy pastes

### Google Drive
- **Sign in with Google** — OAuth via NextAuth (no separate account on this site)
- **Save to Drive** — when signed in, downloads upload directly to your Google Drive
- **Live upload progress** — queue shows upload speed, ETA, and a Drive link when done

### Links & shortcuts
- **Deep links** — `/?url=...&download=1&quality=720p` to analyze and auto-download
- **YouTube-style routes** — `/watch`, `/v/ID`, `/p/ID`, `/playlist?list=ID`
- **Bookmarklet** — drag from Settings to start a download from any YouTube tab
- **Optional [yt-dlp](https://github.com/yt-dlp/yt-dlp) fallback** when ytdl-core fails

### UI
- Pixel-art neo-brutalist design (Press Start 2P + Outfit fonts, Framer Motion animations)
- Real-time download queue with progress, speed, and ETA
- Settings panel for stream mode, auto-save, concurrency, and bookmarklet quality

## Requirements

- Node.js 18+
- npm

Bundled via npm:

- `ffmpeg-static` — audio conversion and A/V muxing

Optional:

- `yt-dlp` on PATH (or set `YT_DLP_PATH`) — used when ytdl-core fails

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Google Drive (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Drive API**
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy client ID and secret into `.env.local`:

```env
NEXTAUTH_SECRET=generate-a-random-32-char-string-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Sign in from the header or hero section. When connected, downloads go to Google Drive instead of the browser.

## Usage

1. Paste a YouTube URL and click **Analyze**
2. Choose quality (or enable clip mode with start/end times)
3. Click **Download** — signed-in users save to Drive; otherwise fast stream or server download runs locally

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
6. Sign in with Google — download saves to Drive with progress in the queue

Analyze only (no auto-download): `http://localhost:3000/?url=https://www.youtube.com/watch?v=VIDEO_ID`

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/info?url=` | Video or playlist metadata |
| `GET /api/download?id=&quality=&taskId=` | SSE server download with progress |
| `DELETE /api/download?taskId=` | Cancel an active download |
| `GET /api/download/stream?id=&quality=&start=&end=` | Direct browser stream |
| `GET /api/download/file?id=&quality=` | Serve completed file from disk |
| `GET /api/download/status?id=&quality=` | Check partial/complete download state |
| `GET /api/cloud/google-drive?id=&quality=&title=&taskId=` | SSE upload to Google Drive |
| `GET /api/auth/[...nextauth]` | NextAuth session and OAuth callbacks |
| `GET /api/health` | ytdl-core / yt-dlp health check |

## Scripts

```bash
npm run dev    # development
npm run build  # production build
npm run start  # production server
npm run lint   # ESLint
```

## Tech stack

- **Next.js 16** — App Router, React 19
- **@distube/ytdl-core** + **@distube/ytpl** — YouTube metadata and streams
- **next-auth** — Google OAuth and session management
- **Tailwind CSS** + **Framer Motion** — pixel UI and animations
- **ffmpeg-static** — transcoding and muxing

## Notes

- Downloads are stored in `downloads/` (gitignored) and auto-cleaned after 24 hours
- Google Drive uploads use the `drive.file` scope — only files created by this app
- Public deployment may require rate limiting (enabled on API routes) and has YouTube ToS implications — intended for self-hosted use
- Browser extensions (e.g. Grammarly, translation tools) can cause hydration warnings in dev; the root layout uses `suppressHydrationWarning` to handle this

## License

MIT — © PIXFETCH Studio

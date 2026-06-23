import { Press_Start_2P, Outfit } from "next/font/google";
import Providers from "../components/Providers";
import "./globals.css";

const pixelFont = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "PIXFETCH — Bold YouTube Downloader",
  description: "Download YouTube videos up to 1080p, extract MP3 audio, save directly to Google Drive, download playlists, and trim clips. Fast, free.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      translate="no"
      className={`${pixelFont.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

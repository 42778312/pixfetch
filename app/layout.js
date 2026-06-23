import { Press_Start_2P, Outfit } from "next/font/google";
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
  description: "Download YouTube videos up to 1080p, extract MP3 audio, download playlists, and trim clips. Fast, free, no registration.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${pixelFont.variable} ${outfit.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}

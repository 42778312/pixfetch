import LegalPage, { LegalList, LegalSection } from '../../components/LegalPage';

export const metadata = {
  title: 'Privacy Policy — PIXFETCH',
  description:
    'How PIXFETCH handles your data, Google sign-in, and Google Drive uploads. We only access files this app creates.',
};

const LAST_UPDATED = 'June 26, 2025';
const CONTACT_EMAIL = 'privacy@pixfetch.app';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <LegalSection title="Summary">
        <p>
          PIXFETCH is a YouTube downloader that can optionally save files to your Google Drive. We
          designed sign-in to request the <strong>minimum Google permissions</strong> needed for
          that feature. We do <strong>not</strong> browse your Drive, read your existing files, or
          sell your personal data.
        </p>
        <p className="mt-3 p-4 bg-green-50 border-2 border-green-600 rounded-xl text-green-900 font-medium">
          Google&apos;s permission screen may sound broad. PIXFETCH uses the restricted{' '}
          <code className="text-xs bg-white px-1 py-0.5 rounded border border-green-300">
            drive.file
          </code>{' '}
          scope — we can only see and manage files that <em>this app</em> creates when you choose
          &quot;Save to Google Drive.&quot;
        </p>
      </LegalSection>

      <LegalSection title="Who operates this service">
        <p>
          This service is operated by <strong>PIXFETCH Studio</strong> (&quot;we&quot;,
          &quot;us&quot;). When you use PIXFETCH at{' '}
          <a href="https://pixfetch.vercel.app" className="underline hover:text-brand-black">
            pixfetch.vercel.app
          </a>{' '}
          or another deployment you trust, this policy describes how we handle information.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>If you use PIXFETCH <strong>without</strong> signing in to Google:</p>
        <LegalList
          items={[
            'YouTube URLs you paste (to fetch video metadata and download streams)',
            'Basic technical data such as IP address and browser type (standard web server logs from our host)',
            'Download preferences stored locally in your browser (settings panel)',
          ]}
        />
        <p className="mt-4">
          If you choose <strong>Sign in with Google</strong>, we also receive:
        </p>
        <LegalList
          items={[
            'Your Google account email address, name, and profile picture (via OpenID Connect)',
            'OAuth access and refresh tokens so we can upload files you request to your Drive',
          ]}
        />
      </LegalSection>

      <LegalSection title="What we do NOT do with Google Drive">
        <LegalList
          items={[
            'We do not list, search, or open files already in your Drive',
            'We do not read documents, photos, spreadsheets, or other files you did not create through PIXFETCH',
            'We do not delete files unless you delete them in Google Drive yourself',
            'We do not access shared drives or change sharing settings on your existing files',
            'We do not sell, rent, or trade your Google account data to advertisers or data brokers',
          ]}
        />
        <p className="mt-3">
          The only Drive action we perform is uploading a video or audio file{' '}
          <strong>when you explicitly start a download to Google Drive</strong>.
        </p>
      </LegalSection>

      <LegalSection title="How downloads and uploads work">
        <p>
          When you download to your device, the file is streamed to your browser. When you save to
          Google Drive, our server temporarily streams the video from YouTube and forwards it to
          Google&apos;s upload API. We do <strong>not</strong> permanently store your downloaded
          videos on our servers after the transfer completes.
        </p>
        <p className="mt-3">
          Clerk manages your Google OAuth session and tokens so you stay signed in across visits.
          Tokens are used only to authenticate Drive uploads on your behalf.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <LegalList
          items={[
            'Google — Sign-in (OAuth) and Google Drive file uploads',
            'YouTube — Source of video/audio streams when you submit a URL',
            'Hosting provider (e.g. Vercel) — Runs the application and may process standard request logs',
          ]}
        />
        <p className="mt-3">
          Each third party has its own privacy policy. Google&apos;s is at{' '}
          <a
            href="https://policies.google.com/privacy"
            className="underline hover:text-brand-black"
            rel="noopener noreferrer"
            target="_blank"
          >
            policies.google.com/privacy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          We use session cookies required for Google sign-in and optional browser local storage for
          your app settings (quality, stream mode, etc.). We do not use advertising or
          cross-site tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <LegalList
          items={[
            'Google OAuth tokens — managed by Clerk until you sign out or revoke access in Google Account settings',
            'Server request logs — retained according to our hosting provider\'s default retention (typically days to weeks)',
            'Downloaded media — not retained on our servers after upload or stream delivery completes',
          ]}
        />
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <LegalList
          items={[
            'Use PIXFETCH without signing in — downloads go to your device only',
            'Sign out anytime using the sign-out button in the app header',
            'Revoke PIXFETCH\'s Google access at myaccount.google.com → Security → Third-party access',
            'Delete files PIXFETCH uploaded by removing them in Google Drive',
            'EU/EEA users may have additional rights under GDPR (access, rectification, erasure, restriction, portability, objection) — contact us below',
          ]}
        />
        <p className="mt-3">
          To revoke access directly:{' '}
          <a
            href="https://myaccount.google.com/permissions"
            className="underline hover:text-brand-black"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google Account permissions
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          PIXFETCH is not directed at children under 13 (or the minimum age in your country). We do
          not knowingly collect personal data from children.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this page when our practices change. The &quot;Last updated&quot; date at the
          top will reflect the latest version. Continued use after changes means you accept the
          updated policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about privacy or data requests:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-brand-black">
            {CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import LegalPage, { LegalList, LegalSection } from '../../components/LegalPage';

export const metadata = {
  title: 'Terms of Service — PIXFETCH',
  description: 'Terms of use for PIXFETCH, the YouTube downloader with optional Google Drive save.',
};

const LAST_UPDATED = 'June 26, 2025';
const CONTACT_EMAIL = 'privacy@pixfetch.app';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <LegalSection title="Agreement">
        <p>
          By using PIXFETCH (&quot;the Service&quot;), operated by PIXFETCH Studio, you agree to
          these Terms of Service. If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="What PIXFETCH does">
        <p>
          PIXFETCH lets you analyze YouTube URLs, download video or audio to your device, and —
          if you sign in with Google — upload downloads you initiate to your own Google Drive
          account. The Service is provided free of charge unless otherwise stated on your deployment.
        </p>
      </LegalSection>

      <LegalSection title="Your responsibilities">
        <LegalList
          items={[
            'You are responsible for ensuring you have the right to download and store any content you request',
            'You must comply with YouTube\'s Terms of Service, applicable copyright law, and local regulations',
            'You must not use the Service to infringe intellectual property, harass others, or distribute malware',
            'You must not attempt to abuse, overload, or reverse-engineer the Service or its APIs',
            'If you sign in with Google, you are responsible for keeping your Google account secure',
          ]}
        />
        <p className="mt-3">
          PIXFETCH does not host YouTube content. We provide a tool; you decide what to download and
          where to save it.
        </p>
      </LegalSection>

      <LegalSection title="Google sign-in and Drive">
        <p>
          Optional Google sign-in is subject to Google&apos;s terms and privacy policies. By
          connecting Google Drive, you authorize PIXFETCH to upload files to your Drive only when
          you explicitly choose a Google Drive download. Our use of Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="underline hover:text-brand-black"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google API Services User Data Policy
          </a>
          , including Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We may modify, suspend, or discontinue any part of the Service at any time without notice.
          We do not guarantee uninterrupted access, specific download speeds, or that every YouTube
          URL will remain downloadable (YouTube may change formats or restrict access).
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. USE AT YOUR OWN RISK.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, PIXFETCH STUDIO AND ITS OPERATORS WILL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
          LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE — EVEN IF WE
          HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
      </LegalSection>

      <LegalSection title="Self-hosted deployments">
        <p>
          PIXFETCH is open source and may be run on your own server. If you deploy your own
          instance, you are the operator of that deployment and responsible for its configuration,
          security, and compliance with these terms as adapted to your environment.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          We may restrict or block access if we reasonably believe you violated these terms or pose
          a risk to the Service or other users. You may stop using the Service at any time and
          revoke Google access through your Google Account settings.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms from time to time. Material changes will be reflected in the
          &quot;Last updated&quot; date. Continued use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-brand-black">
            {CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}

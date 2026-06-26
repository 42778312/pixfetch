import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LegalPage({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b-4 border-brand-black bg-brand-yellow/30 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-black hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PIXFETCH
          </Link>
          <span className="font-pixel text-[10px] sm:text-xs text-brand-black">PIXFETCH</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:py-12">
        <article className="max-w-3xl mx-auto">
          <h1 className="font-pixel text-sm sm:text-base leading-relaxed text-brand-black mb-2">
            {title}
          </h1>
          <p className="text-xs text-neutral-500 font-medium mb-8">Last updated: {lastUpdated}</p>
          <div className="prose-legal space-y-6 text-sm text-neutral-700 leading-relaxed">
            {children}
          </div>
        </article>
      </main>

      <footer className="text-center py-4 border-t-4 border-brand-black text-xs text-neutral-500 font-bold bg-brand-yellow/30">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/privacy" className="hover:text-brand-black hover:underline">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:text-brand-black hover:underline">
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <span>&copy; {new Date().getFullYear()} PIXFETCH Studio</span>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-bold text-brand-black mb-2">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1 mt-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

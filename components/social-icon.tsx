/** Brand marks (lucide no longer ships them), keyed by the name used in BRAND.socials. */
const MARKS: Record<string, React.ReactNode> = {
  Facebook: <path fill="currentColor" stroke="none" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />,
  Instagram: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
};

/** Renders nothing for an account whose mark isn't listed above. */
export function SocialIcon({ name, className }: { name: string; className?: string }) {
  const mark = MARKS[name];
  if (!mark) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      {mark}
    </svg>
  );
}

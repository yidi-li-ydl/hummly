/** A quiet brand illustration, never presented as recorded audio. */
export default function MelodyRibbon({ className = "" }: { className?: string }) {
  return (
    <svg className={`melody-ribbon ${className}`} viewBox="0 0 600 160" fill="none" aria-hidden="true">
      <path d="M-20 105C35 105 40 55 82 55s38 80 82 80 41-115 88-115 41 95 88 95 44-65 90-65 51 65 95 65 51-40 95-40" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
    </svg>
  );
}

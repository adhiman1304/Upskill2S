type WordmarkProps = { className?: string }

/**
 * "upskill" in DM Sans 600, lowercase, -0.02 em. The tittle on the "i" is the
 * accent: an accent "i" sits under a text-colour dotless "ı", so only the dot
 * shows green and the font's own dot position is used at every size.
 */
export function Wordmark({ className }: WordmarkProps) {
  return <span className={['wordmark', className].filter(Boolean).join(' ')} aria-label="Upskill" role="img">
    <span aria-hidden="true">upsk<span className="wordmark-i"><span className="wordmark-i-dot">i</span><span className="wordmark-i-stem">ı</span></span>ll</span>
  </span>
}

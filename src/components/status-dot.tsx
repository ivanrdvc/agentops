export function StatusDot({ hasError }: { hasError: boolean }) {
  return (
    <span
      role="img"
      aria-label={hasError ? 'error' : 'ok'}
      className={['inline-block size-1.5 rounded-full', hasError ? 'bg-rose-500' : 'bg-emerald-500'].join(' ')}
    />
  )
}

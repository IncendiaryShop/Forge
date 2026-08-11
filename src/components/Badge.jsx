export function Badge({ children, className = "" }) {
  return <span className={`type-small-label inline-flex items-center px-2.5 py-1 rounded-full ${className}`}>{children}</span>;
}

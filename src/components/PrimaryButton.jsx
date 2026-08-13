export function PrimaryButton({
  children,
  onClick,
  className = "",
  type = "button",
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`forge-button type-button group relative inline-flex flex-row items-center justify-center
       bg-accent text-[#171717] !font-medium tracking-[-0.01em]
        px-4 py-2.5 rounded-[10px]
        shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_20px_-6px_var(--accent-shadow,rgba(0,0,0,0.35))]
        ring-1 ring-inset ring-white/10
        transition-all duration-150 ease-out
        hover:bg-accent-hover hover:shadow-[0_1px_2px_rgba(0,0,0,0.08),0_10px_24px_-6px_var(--accent-shadow,rgba(0,0,0,0.45))] hover:-translate-y-[1px]
        active:bg-accent/90 active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.08)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg
        disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0
        ${className}`}
    >
      <span className="relative inline-flex flex-row items-center gap-1.5 whitespace-nowrap">
        {children}
      </span>
    </button>
  );
}
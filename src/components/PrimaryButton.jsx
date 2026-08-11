export function PrimaryButton({ children, onClick, className = "", type = "button" }) {
  return (
    <button type={type} onClick={onClick}
      className={`forge-button type-button inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover active:bg-accent/80 text-white px-4 py-2.5 rounded-[14px] shadow-sm shadow-accent/20 ${className}`}>
      {children}
    </button>
  );
}

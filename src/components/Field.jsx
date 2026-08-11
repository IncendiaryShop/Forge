import { useApp } from "../context/AppContext";

export function Field({ label, children }) {
  const { theme } = useApp();
  return (
    <label className="block">
      <span className={`type-card-label block mb-2 ${theme.subtext}`}>{label}</span>
      {children}
    </label>
  );
}

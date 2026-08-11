import { useApp } from "../context/AppContext";

export function Select({ children, ...props }) {
  const { theme } = useApp();
  return <select {...props} className={`forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none ${theme.input}`}>{children}</select>;
}

import { LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";
import { NAV } from "../utils/constants";

export function MobileNav() {
  const { theme, page, setPage, signOut } = useApp();

  return (
    <nav className={`md:hidden sticky bottom-0 border-t backdrop-blur-xl flex justify-around py-2.5 ${theme.sidebar}`}>
      {NAV.map(item => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setPage(item.id)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={`forge-sidebar-nav p-2.5 rounded-[14px] ${active ? "bg-accent/12 text-accent" : theme.subtext}`}
          >
            <item.icon size={19} />
          </button>
        );
      })}
      {signOut && (
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className={`forge-sidebar-nav p-2.5 rounded-[14px] ${theme.subtext}`}
        >
          <LogOut size={19} />
        </button>
      )}
    </nav>
  );
}

import ForgeLogo from "../assets/forge_logo.svg";

/* -------------------------------------------------------------------------
   <MobileBrandHeader>
   -------------------------------------------------------------------------
   The desktop/tablet Sidebar (Sidebar.jsx) shows the Forge logo, but it's
   hidden below the md breakpoint (`hidden md:flex`) — so on mobile the
   logo disappeared entirely. This fills that gap with a compact top bar
   that reuses the exact same logo asset the sidebar uses (just sized for
   a header instead of the full sidebar brand block).

   Rendered once, centrally, in App.jsx's app shell above <main> — not
   duplicated per page. Static (not fixed/sticky), so it sits in normal
   document flow above the page content and never interferes with the
   page's scroll or the overscroll rubber-band effect. `md:hidden` mirrors
   the Sidebar's `md:flex` breakpoint exactly, so the two never show at
   the same time.
------------------------------------------------------------------------- */

export function MobileBrandHeader() {
  return (
    <header
      className="md:hidden flex items-center justify-center bg-[#0e0e0e] border-b border-white/[0.06] px-4 pb-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
    >
      <img src={ForgeLogo} alt="Forge" className="h-7 w-auto select-none" draggable={false} />
    </header>
  );
}

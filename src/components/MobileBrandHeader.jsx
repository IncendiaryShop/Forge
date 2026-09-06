import ForgeLogo from "../assets/forge_logo.svg";

export function MobileBrandHeader() {
  return (
    <header
      className="md:hidden flex items-center justify-center bg-sidebar border-b border-border-subtle px-4 pb-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
    >
      <img src={ForgeLogo} alt="Forge" className="h-7 w-auto select-none" draggable={false} />
    </header>
  );
}

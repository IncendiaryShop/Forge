export function StartupSplash({ active }) {
  return (
    <div
      aria-hidden={!active}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-150"
      style={{
        opacity: active ? 1 : 0,
        pointerEvents: active ? "auto" : "none",
      }}
    >
      <span className="forge-splash-loader" aria-hidden="true" />
    </div>
  );
}
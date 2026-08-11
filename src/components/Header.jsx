import { useApp } from "../context/AppContext";

export function Header() {
  const { theme } = useApp();

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 17
      ? "Good Afternoon"
      : "Good Evening";

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur-xl border-b px-6 sm:px-10 lg:px-12 py-7 flex items-center justify-between ${theme.content}`}
    >
      <div>
  <h1 className="text-[40px] font-bold tracking-[-0.03em] leading-none">
    {greeting}, Arpit 👋
  </h1>

  <p className={`mt-3 text-[15px] ${theme.subtext}`}>
    Here's your financial overview today.
  </p>
</div>
    </header>
  );
}
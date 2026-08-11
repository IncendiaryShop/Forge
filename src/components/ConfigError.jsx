import { theme } from "../styles/theme";

export function ConfigError() {
  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${theme.app}`}>
      <div className={`max-w-md w-full rounded-[20px] border p-7 ${theme.card}`}>
        <h1 className="type-section-title mb-3">Supabase isn't configured</h1>
        <p className={`type-secondary mb-4 ${theme.subtext}`}>
          Forge needs a Supabase project URL and publishable key to run. Copy
          <code className="mx-1 px-1.5 py-0.5 rounded bg-elevated">.env.example</code>
          to <code className="mx-1 px-1.5 py-0.5 rounded bg-elevated">.env.local</code>,
          fill in your project's values, and restart the dev server.
        </p>
        <pre className="text-xs rounded-[14px] p-4 bg-elevated overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key`}
        </pre>
      </div>
    </div>
  );
}

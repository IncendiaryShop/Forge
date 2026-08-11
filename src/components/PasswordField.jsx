import { theme } from "../styles/theme";

// Same markup/classes/behavior as the password field already in AuthGate's
// sign-in form — extracted here only so the new password-reset screen can
// reuse the identical show/hide toggle without duplicating the SVGs twice
// more. The existing sign-in password field in AuthGate.jsx is left exactly
// as it was and does NOT use this component, per the "do not touch existing
// password show/hide functionality" requirement.
export function PasswordField({ label, id, value, onChange, autoComplete, show, onToggleShow, required = true }) {
  return (
    <label className="block mb-5" htmlFor={id}>
      <span className={`type-card-label block mb-2 ${theme.subtext}`}>{label}</span>

      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="
            forge-control
            w-full
            h-12
            pl-4
            pr-12
            rounded-[12px]
            border
            border-white/15
            bg-black/30
            backdrop-blur-md
            text-[14px]
            text-white
            placeholder:text-white/35
            outline-none
            transition-all
            duration-300
            focus:border-[#7C6CF3]/50
            focus:bg-black/40
            focus:shadow-[0_0_0_1px_rgba(124,108,243,0.18),0_0_15px_rgba(124,108,243,0.55),0_8px_35px_rgba(124,108,243,0.35)]
          "
          required={required}
        />

        <button
          type="button"
          onClick={onToggleShow}
          className="
            absolute
            right-2
            top-1/2
            -translate-y-1/2
            flex
            items-center
            justify-center
            w-9
            h-9
            rounded-lg
            text-white/45
            hover:text-white/80
            hover:bg-white/[0.06]
            transition-colors
          "
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.8 6.5a1.8 1.8 0 0 1 0 1c-.5 1-1.4 2.3-2.7 3.5" />
              <path d="M6.6 6.6C4.8 7.8 3.5 9.5 2.2 11.5a1.8 1.8 0 0 0 0 1C3.5 14.5 7 18 12 18c1 0 1.9-.2 2.8-.5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.2 12s3.5-6 9.8-6 9.8 6 9.8 6-3.5 6-9.8 6-9.8-6-9.8-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

import { useState } from "react";
import { theme } from "../styles/theme";
import { useAuth } from "../context/AuthCtx";
import MoltenMetal from "./MoltenMetal";
import forgeLogo from "../assets/forge_logo.svg";

export function AuthGate() {
  const { signUp, signIn } = useAuth();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setInfo("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);

    const { error: authError } =
      mode === "signup"
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);

    setBusy(false);

    if (authError) {
      setError(authError);
      return;
    }

    if (mode === "signup") {
      setInfo(
        "Account created. Check your email to confirm, then sign in."
      );
      setMode("signin");
      setShowPassword(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "signup" ? "signin" : "signup");
    setError("");
    setInfo("");
    setShowPassword(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-10 bg-black">

      {/* Molten Metal Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <MoltenMetal
          color1="#1c1c1c"
          color2="#7C6CF3"
          color3="#FFFFFF"
          speed={0.2}
          scale={3.6}
          detail={5}
          glow={1.7}
          coreSize={0.11}
          swirl={1}
          fold={-0.2}
          blackPoint={0.05}
          brightness={1}
          colorMode="molten"
          grain
          grainIntensity={0.05}
          opacity={1}
        />
      </div>

      {/* Glass Authentication Card */}
      {(mode === "signin" || mode === "signup") && (
      <form
        onSubmit={submit}
        className="
          relative
          z-10
          w-full
          max-w-[420px]
          rounded-[24px]
          border
          border-white/[0.10]
          bg-black/[0.35]
          backdrop-blur-[24px]
          p-9
          shadow-[0_20px_60px_rgba(0,0,0,0.35)]
          before:absolute
          before:inset-x-0
          before:top-0
          before:h-px
          before:bg-gradient-to-r
          before:from-transparent
          before:via-white/[0.18]
          before:to-transparent
        "
      >

        {/* Logo */}
        <div className="flex justify-center mb-7">
          <img
            src={forgeLogo}
            alt="Forge"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Top Label */}
        <p
          className="
            text-[11px]
            font-medium
            tracking-wide
            text-white/60
            mb-1
            text-center
            drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]
          "
        >
          {mode === "signup"
            ? "Start your journey"
            : "Login to your account"}
        </p>

        {/* Main Heading */}
        <h1
          className="
            text-[36px]
            font-bold
            tracking-[-0.04em]
            text-white
            leading-tight
            mb-1
            text-center
            drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]
          "
        >
          {mode === "signup"
            ? "Create Your Account"
            : "Welcome Back!"}
        </h1>

        {/* Subtitle */}
        <p
          className="
            text-[14px]
            text-white/60
            mb-8
            text-center
            drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]
          "
        >
          {mode === "signup"
            ? "Get started with Forge today"
            : "Enter your email and password"}
        </p>

        {/* Email */}
        <label className="block mb-5">
          <span
            className={`
              type-card-label
              block
              mb-2
              ${theme.subtext}
            `}
          >
            Email
          </span>

          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="
              forge-control
              w-full
              h-12
              px-4
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
            required
          />
        </label>

        {/* Password */}
        <label className="block mb-5">
          <span
            className={`
              type-card-label
              block
              mb-2
              ${theme.subtext}
            `}
          >
            Password
          </span>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "signup"
                  ? "new-password"
                  : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              required
            />

            {/* Show / Hide Password */}
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
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
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              title={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                /* Eye Off */
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.8 6.5a1.8 1.8 0 0 1 0 1c-.5 1-1.4 2.3-2.7 3.5" />
                  <path d="M6.6 6.6C4.8 7.8 3.5 9.5 2.2 11.5a1.8 1.8 0 0 0 0 1C3.5 14.5 7 18 12 18c1 0 1.9-.2 2.8-.5" />
                </svg>
              ) : (
                /* Eye */
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.2 12s3.5-6 9.8-6 9.8 6 9.8 6-3.5 6-9.8 6-9.8-6-9.8-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>
        </label>

        {/* Forgot Password (sign-in only) */}
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError("");
              setInfo("");
            }}
            className="
              type-secondary
              w-full
              text-center
              -mt-2
              mb-5
              text-[13px]
              text-white/65
              hover:text-white
              transition-colors
            "
          >
            Forgot password?
          </button>
        )}

        {/* Error Message */}
        {error && (
          <p className="type-secondary text-red-500 mb-4 text-center">
            {error}
          </p>
        )}

        {/* Success Message */}
        {info && (
          <p className="type-secondary text-emerald-400 mb-4 text-center">
            {info}
          </p>
        )}

        {/* Submit Button */}
<button
  type="submit"
  disabled={busy}
  className="
    forge-button
    specular-button
    type-button
    w-full
    justify-center
    inline-flex
    items-center
    gap-1.5
    bg-accent
    hover:bg-accent-hover
    active:bg-accent/80
    text-white
    px-4
    py-2.5
    rounded-[14px]
    border
    border-white/10
    shadow-[0_0_18px_rgba(124,108,243,0.22)]
    hover:shadow-[0_0_30px_rgba(124,108,243,0.48)]
    disabled:opacity-60
    transition-all
    duration-300
  "
>
  <span className="specular-button__shine" aria-hidden="true" />

  {busy
    ? "Please wait…"
    : mode === "signup"
      ? "Create account"
      : "Sign in"}
</button>

        {/* Sign In / Sign Up Toggle */}
        <button
          type="button"
          onClick={toggleMode}
          className="
            type-secondary
            w-full
            text-center
            mt-5
            text-[13px]
            text-white/65
            hover:text-white
            transition-colors
          "
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>

      </form>
      )}

      {mode === "forgot" && (
        <ForgotPasswordCard
          email={email}
          setEmail={setEmail}
          onSent={() => setMode("forgot-sent")}
          onBack={() => {
            setMode("signin");
            setError("");
            setInfo("");
          }}
        />
      )}

      {mode === "forgot-sent" && (
        <ForgotPasswordSentCard
          email={email}
          onBack={() => {
            setMode("signin");
            setError("");
            setInfo("");
          }}
        />
      )}
    </div>
  );
}

/* --------------------------- Forgot password card --------------------------- */

const cardClass = `
  relative
  z-10
  w-full
  max-w-[420px]
  rounded-[24px]
  border
  border-white/[0.10]
  bg-black/[0.35]
  backdrop-blur-[24px]
  p-9
  shadow-[0_20px_60px_rgba(0,0,0,0.35)]
  before:absolute
  before:inset-x-0
  before:top-0
  before:h-px
  before:bg-gradient-to-r
  before:from-transparent
  before:via-white/[0.18]
  before:to-transparent
`;

const emailInputClass = `
  forge-control
  w-full
  h-12
  px-4
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
`;

const submitBtnClass = `
  forge-button
  type-button
  w-full
  justify-center
  inline-flex
  items-center
  gap-1.5
  bg-accent
  hover:bg-accent-hover
  active:bg-accent/80
  text-white
  px-4
  py-2.5
  rounded-[14px]
  border
  border-white/10
  shadow-[0_0_18px_rgba(124,108,243,0.22)]
  hover:shadow-[0_0_30px_rgba(124,108,243,0.48)]
  disabled:opacity-60
  transition-all
  duration-300
`;

const backLinkClass = `
  type-secondary
  w-full
  text-center
  mt-5
  text-[13px]
  text-white/65
  hover:text-white
  transition-colors
`;

function ForgotPasswordCard({ email, setEmail, onSent, onBack }) {
  const { resetPasswordForEmail } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await resetPasswordForEmail(trimmed);
    setBusy(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    onSent();
  };

  return (
    <form onSubmit={submit} className={cardClass}>
      <div className="flex justify-center mb-7">
        <img src={forgeLogo} alt="Forge" className="h-10 w-auto object-contain" />
      </div>

      <h1 className="text-[36px] font-bold tracking-[-0.04em] text-white leading-tight mb-1 text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
        Reset your password
      </h1>

      <p className="text-[14px] text-white/60 mb-8 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
        Enter the email associated with your Forge account.
      </p>

      <label className="block mb-5">
        <span className={`type-card-label block mb-2 ${theme.subtext}`}>Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={emailInputClass}
          required
        />
      </label>

      {error && <p className="type-secondary text-red-500 mb-4 text-center">{error}</p>}

      <button type="submit" disabled={busy} className={submitBtnClass}>
        {busy ? "Please wait…" : "Send reset link"}
      </button>

      <button type="button" onClick={onBack} className={backLinkClass}>
        Back to sign in
      </button>
    </form>
  );
}

function ForgotPasswordSentCard({ email, onBack }) {
  return (
    <div className={cardClass}>
      <div className="flex justify-center mb-7">
        <img src={forgeLogo} alt="Forge" className="h-10 w-auto object-contain" />
      </div>

      <h1 className="text-[36px] font-bold tracking-[-0.04em] text-white leading-tight mb-1 text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
        Check your email
      </h1>

      <p className="text-[14px] text-white/60 mb-8 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
        We&apos;ve sent a password reset link{email.trim() ? <> to <span className="text-white/80">{email.trim()}</span></> : ""}. Follow the link to create a new password.
      </p>

      <button type="button" onClick={onBack} className={submitBtnClass}>
        Back to sign in
      </button>
    </div>
  );
}
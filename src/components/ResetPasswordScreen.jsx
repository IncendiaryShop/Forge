import { useState } from "react";
import { useAuth } from "../context/AuthCtx";
import MoltenMetal from "./MoltenMetal";
import forgeLogo from "../assets/forge_logo.svg";
import { PasswordField } from "./PasswordField";
import { PrimaryButton } from "./PrimaryButton";

export function ResetPasswordScreen() {
  const { updatePassword, exitRecovery } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await updatePassword(password);
    setBusy(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    setDone(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-10 bg-black">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <MoltenMetal
          color1="#0a0a0a"
          color2="#9f9fa9"
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

      {done ? (
        <div
          className="
            relative z-10 w-full max-w-[420px] rounded-[24px] border border-border
            bg-black/[0.35] backdrop-blur-[24px] p-9 shadow-[0_20px_60px_rgba(0,0,0,0.35)]
            before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r
            before:from-transparent before:via-white/[0.18] before:to-transparent
          "
        >
          <div className="flex justify-center mb-7">
            <img src={forgeLogo} alt="Forge" className="h-10 w-auto object-contain" />
          </div>

          <h1 className="text-[36px] font-bold tracking-[-0.04em] text-white leading-tight mb-1 text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Password updated
          </h1>

          <p className="text-[14px] text-white/60 mb-8 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            Your password has been changed successfully.
          </p>

          <PrimaryButton
            onClick={exitRecovery}
            className="w-full justify-center shadow-[0_0_18px_rgba(124,108,243,0.22)] hover:shadow-[0_0_30px_rgba(124,108,243,0.48)] transition-shadow duration-300"
          >
            Back to sign in
          </PrimaryButton>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="
            relative z-10 w-full max-w-[420px] rounded-[24px] border border-border
            bg-black/[0.35] backdrop-blur-[24px] p-9 shadow-[0_20px_60px_rgba(0,0,0,0.35)]
            before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r
            before:from-transparent before:via-white/[0.18] before:to-transparent
          "
        >
          <div className="flex justify-center mb-7">
            <img src={forgeLogo} alt="Forge" className="h-10 w-auto object-contain" />
          </div>

          <h1 className="text-[36px] font-bold tracking-[-0.04em] text-white leading-tight mb-1 text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Set a new password
          </h1>

          <p className="text-[14px] text-white/60 mb-8 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            Choose a new password for your Forge account.
          </p>

          <PasswordField
            id="new-password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            show={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
          />

          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((v) => !v)}
          />

          {error && <p className="type-secondary text-danger mb-4 text-center">{error}</p>}

          <PrimaryButton
            type="submit"
            disabled={busy}
            className="w-full justify-center shadow-[0_0_18px_rgba(124,108,243,0.22)] hover:shadow-[0_0_30px_rgba(124,108,243,0.48)] transition-shadow duration-300"
          >
            {busy ? "Please wait…" : "Update password"}
          </PrimaryButton>

          <button
            type="button"
            onClick={exitRecovery}
            className="type-secondary w-full text-center mt-5 text-[13px] text-white/65 hover:text-white transition-colors"
          >
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { toUserMessage } from "../services/errors";
import { AuthCtx } from "./AuthCtx";

export function AuthProvider({ children }) {
  // "loading" | "signed-out" | "signed-in" | "recovery"
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  // Tracks whether we're in a password-recovery session so a later, unrelated
  // auth event (e.g. the token refresh that follows) can't silently bounce
  // the user out of the "set a new password" screen and into the main app.
  const recoveryRef = useRef(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active || recoveryRef.current) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session?.user ? "signed-in" : "signed-out");
    });

    // Keeps auth state in sync across tabs, token refreshes, and sign-out —
    // also fires on initial load, but the getSession() call above already
    // resolves the first paint so there's no flash of the wrong state.
    //
    // PASSWORD_RECOVERY fires when the app loads with a Supabase password
    // recovery link in the URL (see AuthGate's "Forgot password?" ->
    // resetPasswordForEmail, and the redirect back into this same app).
    // supabase-js (detectSessionInUrl: true, already configured in
    // lib/supabase.js) parses that link and establishes a session itself —
    // we only need to react to the event so the app shows the "set a new
    // password" screen instead of treating it as a normal sign-in.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setUser(session?.user ?? null);
        setStatus("recovery");
        return;
      }

      if (event === "SIGNED_OUT") {
        recoveryRef.current = false;
        setUser(null);
        setStatus("signed-out");
        return;
      }

      if (recoveryRef.current) return; // stay on the recovery screen until sign-out or explicit exit

      setUser(session?.user ?? null);
      setStatus(session?.user ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? toUserMessage(error, "Couldn't create your account.") : null };
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? toUserMessage(error, "Couldn't sign in.") : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Supabase's resetPasswordForEmail() always resolves without error for a
  // syntactically valid email regardless of whether an account exists for
  // it — this is Supabase's own anti-enumeration behavior, not something
  // this function needs to special-case.
  const resetPasswordForEmail = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error ? toUserMessage(error, "Couldn't send the reset link.") : null };
  };

  // Only meaningful while status === "recovery" (a valid recovery session is
  // required server-side for this to succeed).
  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? toUserMessage(error, "Couldn't update your password.") : null };
  };

  // Leaves the recovery flow without landing the user in the main app —
  // signs out of the recovery session and returns to the normal sign-in
  // screen, matching the documented end-to-end flow ("Return to sign in",
  // then sign in again with the new password).
  const exitRecovery = async () => {
    recoveryRef.current = false;
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider value={{ status, user, signUp, signIn, signOut, resetPasswordForEmail, updatePassword, exitRecovery }}>
      {children}
    </AuthCtx.Provider>
  );
}
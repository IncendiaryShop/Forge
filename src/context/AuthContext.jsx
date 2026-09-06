import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { toUserMessage } from "../services/errors";
import { AuthCtx } from "./AuthCtx";

export function AuthProvider({ children }) {

  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  const recoveryRef = useRef(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active || recoveryRef.current) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session?.user ? "signed-in" : "signed-out");
    });

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

      if (recoveryRef.current) return;

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

  const resetPasswordForEmail = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error ? toUserMessage(error, "Couldn't send the reset link.") : null };
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? toUserMessage(error, "Couldn't update your password.") : null };
  };

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

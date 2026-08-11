import { useEffect, useState } from "react";
import { theme } from "../styles/theme";
import { getMigrationState, migrateLocalDataToCloud, clearLocalData, markMigratedWithoutImporting } from "../services/migration";

function Screen({ title, children }) {
  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${theme.app}`}>
      <div className={`max-w-md w-full rounded-[20px] border p-7 ${theme.card}`}>
        <h1 className="type-section-title mb-3">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// Gates the app behind the one-time local -> cloud migration described in
// section 11 of the migration brief. See services/migration.js for the exact
// state machine and safety rules — this component is purely presentational
// plumbing around it.
export function MigrationGate({ userId, children }) {
  // "checking" | "migrating" | "ambiguous" | "error" | "done"
  const [phase, setPhase] = useState("checking");
  const [ambiguousLocal, setAmbiguousLocal] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const run = async () => {
    setPhase("checking");
    const result = await getMigrationState(userId);

    if (result.state === "error") {
      setErrorMsg(result.error?.message || "Couldn't check your data.");
      setPhase("error");
      return;
    }
    if (result.state === "already-migrated" || result.state === "no-local-data") {
      setPhase("done");
      return;
    }
    if (result.state === "ambiguous") {
      setAmbiguousLocal(result.local);
      setPhase("ambiguous");
      return;
    }

    // ready-to-migrate
    setPhase("migrating");
    const outcome = await migrateLocalDataToCloud(userId, result.local);
    if (!outcome.success) {
      setErrorMsg(outcome.error?.message || "Migration failed.");
      setPhase("error");
      return;
    }
    clearLocalData();
    setPhase("done");
  };

  useEffect(() => {
    queueMicrotask(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const keepCloudData = async () => {
    // Explicit user choice: discard the local copy, treat cloud data as
    // authoritative going forward, and record that so this screen never
    // reappears for this account.
    clearLocalData();
    const { error } = await markMigratedWithoutImporting(userId);
    if (error) {
      setErrorMsg(error.message);
      setPhase("error");
      return;
    }
    setPhase("done");
  };

  if (phase === "checking") {
    return <Screen title="Checking your data…"><p className={`type-secondary ${theme.subtext}`}>One moment.</p></Screen>;
  }

  if (phase === "migrating") {
    return (
      <Screen title="Moving your data to the cloud…">
        <p className={`type-secondary ${theme.subtext}`}>
          We found data saved in this browser and are copying it to your account. Don't close this tab.
        </p>
      </Screen>
    );
  }

  if (phase === "ambiguous") {
    return (
      <Screen title="Two copies of your data found">
        <p className={`type-secondary mb-4 ${theme.subtext}`}>
          This browser has locally saved Forge data, and your account already has data in the cloud.
          To avoid mixing up your finances, choose how to proceed — this can't be undone automatically.
        </p>
        <p className={`type-secondary mb-5 ${theme.subtext}`}>
          Local data found: {ambiguousLocal?.accounts.length || 0} accounts, {ambiguousLocal?.transactions.length || 0} transactions,
          {" "}{ambiguousLocal?.bills.length || 0} bills, {ambiguousLocal?.invoices.length || 0} invoices, {ambiguousLocal?.goals.length || 0} goals.
        </p>
        <button
          type="button"
          onClick={keepCloudData}
          className="forge-button type-button w-full justify-center inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-[14px] mb-3"
        >
          Use my cloud data (discard this browser's local data)
        </button>
        <p className={`type-secondary text-xs ${theme.subtext}`}>
          Need the local data instead, or unsure? Don't proceed here — export/back it up first, then contact support.
        </p>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen title="Something went wrong">
        <p className="type-secondary text-red-500 mb-5">{errorMsg}</p>
        <button
          type="button"
          onClick={run}
          className="forge-button type-button w-full justify-center inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-[14px]"
        >
          Try again
        </button>
      </Screen>
    );
  }

  return children;
}

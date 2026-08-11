import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, PrimaryButton, GhostButton, IconBtn, Field, TextInput, ProgressBar, Modal, EmptyState, AppIcon } from "../components";
import { GoalForm } from "../forms/GoalForm";
import { fmt } from "../utils/helpers";

export function GoalsPage() {
  const { data, theme, deleteGoal, contributeGoal } = useApp();
  const [modal, setModal] = useState(null);
  const [contribute, setContribute] = useState(null);
  const [amt, setAmt] = useState("");
  const [contributeError, setContributeError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = () => {
    deleteGoal(deleteTarget.id);
    setDeleteTarget(null);
  };

  const submitContribution = (e) => {
    e.preventDefault();
    const value = Number(amt);
    if (amt.trim() === "" || Number.isNaN(value) || value <= 0) {
      setContributeError("Enter an amount greater than 0.");
      return;
    }
    contributeGoal(contribute, value);
    setContribute(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setModal("new")}><Plus size={15} /> Add Goal</PrimaryButton>
      </div>
      {data.goals.length === 0 ? (
        <Card className="p-7"><EmptyState icon={(p) => <AppIcon name="goals.savings" {...p} />} title="No savings goals" subtitle="Set a goal to start tracking progress" /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.goals.map(g => {
            const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
            return (
              <Card key={g.id} className="p-7 group">
                <div className="flex items-start justify-between">
                  <div className="forge-card-icon w-10 h-10 rounded-[14px] bg-white/5 flex items-center justify-center">
                    <AppIcon name="goals.savings" size={17} className="forge-card-icon__glyph" />
                  </div>
                  <div className="forge-card-actions flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <IconBtn icon={Pencil} onClick={() => setModal(g)} title="Edit" />
                    <IconBtn icon={Trash2} danger onClick={() => setDeleteTarget(g)} title="Delete" />
                  </div>
                </div>
                <p className="type-body font-semibold mt-4">{g.name}</p>
                {g.deadline && (
                  <p className={`type-small-label mt-0.5 flex items-center gap-1.5 ${theme.subtext}`}>
                    <AppIcon name="goals.deadline" size={12} />
                    Target date: {g.deadline}
                  </p>
                )}
                <p className="type-section-title mt-3">{fmt(g.current)} <span className={`type-secondary ${theme.subtext}`}>/ {fmt(g.target)}</span></p>
                <div className="mt-3"><ProgressBar pct={pct} /></div>
                <p className={`type-secondary mt-2 ${theme.subtext}`}>{Math.round(pct)}% complete</p>
                <GhostButton className="w-full justify-center mt-4" onClick={() => { setContribute(g.id); setAmt(""); setContributeError(""); }}>
                  <AppIcon name="goals.contribution" size={13} /> Add Contribution
                </GhostButton>
              </Card>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Goal" : "Edit Goal"} onClose={() => setModal(null)}>
          <GoalForm existing={modal === "new" ? null : modal} onDone={() => setModal(null)} />
        </Modal>
      )}

      {contribute && (
        <Modal title="Add Contribution" onClose={() => setContribute(null)}>
          <form onSubmit={submitContribution} className="space-y-4">
            <Field label="Amount (₹)">
              <TextInput type="number" min="0.01" step="0.01" autoFocus value={amt} onChange={(e) => setAmt(e.target.value)} required />
            </Field>
            {contributeError && <p className="type-secondary text-red-500">{contributeError}</p>}
            <PrimaryButton type="submit" className="w-full justify-center">Add</PrimaryButton>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Goal" onClose={() => setDeleteTarget(null)}>
          <div className="flex items-start gap-3 mb-5">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <p className={`type-secondary ${theme.subtext}`}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <GhostButton className="flex-1 justify-center" onClick={() => setDeleteTarget(null)}>Cancel</GhostButton>
            <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete}>Delete Goal</PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
import { supabase } from "../lib/supabase";
import { call } from "./errors";

const fromRow = (r) => ({
  id: r.id,
  accountId: r.account_id,
  cycleKey: r.cycle_key,
  statementDate: r.statement_date,
  dueDate: r.due_date,
  statementBalance: Number(r.statement_balance),
  createdAt: r.created_at,
});
export { fromRow as mapCreditCardStatementRow };

export async function listCreditCardStatements() {
  const { data, error } = await call(
    supabase.from("credit_card_statements").select("*").order("statement_date", { ascending: true }),
    "Couldn't load credit card statements."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function generateStatement(accountId, cycleKey, statementDate, dueDate) {
  const { data, error } = await call(
    supabase.rpc("generate_statement", {
      p_account_id: accountId,
      p_cycle_key: cycleKey,
      p_statement_date: statementDate,
      p_due_date: dueDate || null,
    }),
    "Couldn't generate the statement."
  );
  if (error) return { data: null, error };
  return { data: fromRow(data), error: null };
}

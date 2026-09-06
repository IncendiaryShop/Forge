import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { PrimaryButton } from "./PrimaryButton";
import { GhostButton } from "./GhostButton";
import { AppIcon } from "./AppIcon";
import { useApp } from "../context/AppContext";
import { getSignedInvoiceUrl } from "../services/invoiceStorage";

export function InvoiceDetailModal({ invoice, onClose, onEdit }) {
  const { theme, isDemoMode, regenerateInvoicePdf } = useApp();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDemoMode || !invoice.pdfPath) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await getSignedInvoiceUrl(invoice.pdfPath);
      if (!cancelled) {
        if (error) setErr(error.message);
        else setUrl(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoice, isDemoMode]);

  const regenerate = async () => {
    setRegenerating(true);
    setErr("");
    const r = await regenerateInvoicePdf(invoice.id);
    setRegenerating(false);
    if (r?.error) setErr(r.error.message || "Couldn't regenerate the PDF.");
    else if (r?.blobUrl) setUrl(r.blobUrl);
  };

  return (
    <Modal title={invoice.invoiceNumber} onClose={onClose} wide>
      <div className="space-y-5">
        {invoice.needsRegeneration && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] bg-amber-500/10 border border-amber-500/20">
            <AppIcon name="ui.warning" size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <p className={`type-secondary ${theme.subtext}`}>This invoice was edited after the PDF was generated. The PDF may be out of date.</p>
          </div>
        )}

        <div>
          <p className="type-card-label mb-2">PDF</p>
          {!invoice.pdfPath && !url ? (
            <p className={`type-secondary ${theme.subtext}`}>No PDF for this invoice.</p>
          ) : loading ? (
            <p className={`type-secondary ${theme.subtext}`}>Loading…</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {url && <GhostButton onClick={() => window.open(url, "_blank", "noopener")}><AppIcon name="ui.view" size={14} /> View PDF</GhostButton>}
              {url && <a href={url} download={`${invoice.invoiceNumber}.pdf`} className="forge-button type-button inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[10px] bg-accent text-bg !font-medium hover:bg-accent-hover transition-all duration-150"><AppIcon name="ui.download" size={14} /> Download</a>}
              {invoice.needsRegeneration && (
                <PrimaryButton onClick={regenerate} disabled={regenerating}>{regenerating ? "Regenerating..." : "Regenerate PDF"}</PrimaryButton>
              )}
            </div>
          )}
        </div>

        {err && <p className="type-secondary text-red-500">{err}</p>}

        <div className="flex items-center gap-3">
          <GhostButton className="flex-1 justify-center" onClick={onClose}>Close</GhostButton>
          {onEdit && <PrimaryButton className="flex-1 justify-center" onClick={onEdit}>Edit Invoice</PrimaryButton>}
        </div>
      </div>
    </Modal>
  );
}

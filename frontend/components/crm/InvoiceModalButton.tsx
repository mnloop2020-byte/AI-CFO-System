"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import InvoiceForm from "@/components/crm/InvoiceForm";
import Modal from "@/components/ui/Modal";

export default function InvoiceModalButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        <Plus size={18} />
        Create invoice
      </button>

      <Modal
        open={open}
        title="Create invoice"
        description="Add invoice amounts, payment details, VAT, and documents."
        onClose={() => setOpen(false)}
      >
        <InvoiceForm
          onCancel={() => setOpen(false)}
          onSave={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
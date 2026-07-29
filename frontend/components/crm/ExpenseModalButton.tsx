"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import ExpenseForm from "@/components/crm/ExpenseForm";
import Modal from "@/components/ui/Modal";

export default function ExpenseModalButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        <Plus size={18} />
        Record expense
      </button>

      <Modal
        open={open}
        title="Record expense"
        description="Add spending details and supporting documents."
        onClose={() => setOpen(false)}
      >
        <ExpenseForm
          onCancel={() => setOpen(false)}
          onSave={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
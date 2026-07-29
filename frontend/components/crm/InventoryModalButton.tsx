"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import InventoryForm from "@/components/crm/InventoryForm";
import Modal from "@/components/ui/Modal";

export default function InventoryModalButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        <Plus size={18} />
        Add product
      </button>

      <Modal
        open={open}
        title="Add product"
        description="Create a product record and configure its stock values."
        onClose={() => setOpen(false)}
      >
        <InventoryForm
          onCancel={() => setOpen(false)}
          onSave={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Two-step confirmation for destructive actions.
 *
 * `onConfirm` does the work and should resolve even when the server rejects the
 * request, so the dialog closes either way and the toast explains the outcome.
 * `hidden` is forwarded to the trigger's pending state label when provided.
 */
export function DeleteConfirm({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  trigger,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await onConfirm();
      setOpen(false);

      if (result?.ok) {
        if (result.message) toast({ title: result.message, variant: "success" });
      } else if (result?.error) {
        toast({ title: result.error, variant: "danger" });
      }
    } catch {
      setOpen(false);
      toast({ title: "Something went wrong. Please try again.", variant: "danger" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className={className}
        >
          {confirmLabel}
        </Button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} label={title} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
        </DialogBody>

        <DialogFooter>
          <DialogClose onClick={() => setOpen(false)}>Cancel</DialogClose>
          <Button variant="danger" loading={pending} onClick={handleConfirm}>
            {pending ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

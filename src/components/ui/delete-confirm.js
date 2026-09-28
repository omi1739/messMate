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
 * `onConfirm` must **return** the action result. It is the only thing that says
 * whether the work succeeded: when it resolves to `undefined` the dialog still
 * closes but no toast is shown at all, so a rejected delete (a self-delete
 * guard, a database error, a dropped connection) looks exactly like a success.
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
      } else {
        toast({
          title: result?.error ?? "That did not work. Please try again.",
          variant: "danger",
        });
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

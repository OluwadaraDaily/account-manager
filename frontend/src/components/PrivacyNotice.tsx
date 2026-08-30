import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "./Icon";
import { playSensoryCue } from "../utils/sensoryFeedback";

export function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    playSensoryCue(nextOpen ? "overlayOpen" : "overlayClose");
    setOpen(nextOpen);
  };

  return (
    <>
      <section className="border-line bg-card text-muted mt-5 flex flex-col justify-between gap-4 border px-5 py-4 text-[12px] sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="text-moss mt-0.5">
            <Icon name="shield" size={17} />
          </span>
          <p>
            <span className="text-ink font-mono text-[10px] font-bold tracking-[0.1em] uppercase">
              Privacy by design.
            </span>{" "}
            Read-only Gmail access. Selected messages become transaction records for your review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className="text-ink focus-ring font-mono text-[10px] font-bold tracking-[0.1em] whitespace-nowrap uppercase underline underline-offset-4"
        >
          How it works
        </button>
      </section>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="border-line bg-card text-ink rounded-none shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-[-0.04em]">
              How your data moves
            </DialogTitle>
            <DialogDescription className="text-muted leading-6">
              The app only looks for the Gmail messages you select, then turns matching alerts into
              editable transaction records.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-[12px] leading-5">
            <div className="border-line bg-paper border p-4">
              <p className="text-ink font-bold">01 / Read-only connection</p>
              <p className="text-muted mt-1">
                Gmail access is limited to reading messages. Account Manager cannot send, delete, or
                change your email.
              </p>
            </div>
            <div className="border-line bg-paper border p-4">
              <p className="text-ink font-bold">02 / Focused processing</p>
              <p className="text-muted mt-1">
                Matching messages are processed into normalized transaction records. Raw email
                content is not stored as a transaction.
              </p>
            </div>
            <div className="border-line bg-paper border p-4">
              <p className="text-ink font-bold">03 / Your review</p>
              <p className="text-muted mt-1">
                Review, correct, or dismiss matches before exporting them to your spreadsheet.
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "./Icon";

export function AppHeader() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="border-line bg-paper/85 sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-black shadow-sm ring-1 ring-white/10">
            <Icon name="spark" size={19} />
          </div>
          <span className="font-display text-[17px] font-extrabold tracking-[-0.03em]">
            account manager
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-muted hidden items-center gap-2 text-[12px] sm:flex">
            <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.12)]" />
            Local-only mode
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHelpOpen(true)}
            className="border-line bg-card text-ink hover:border-ink rounded-full px-4 font-semibold shadow-none"
          >
            Help
          </Button>
        </div>
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border-line bg-card text-ink rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-[-0.04em]">
              A clearer way to review your money
            </DialogTitle>
            <DialogDescription className="text-muted leading-6">
              Account Manager reads selected transaction emails, turns them into normalized records,
              and keeps the review and export flow focused on the information you need.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-[12px] leading-5">
            <div className="border-line bg-paper rounded-[16px] border p-4">
              <p className="text-ink font-bold">Read-only Gmail access</p>
              <p className="text-muted mt-1">No bank passwords and no Gmail write actions.</p>
            </div>
            <div className="border-line bg-paper rounded-[16px] border p-4">
              <p className="text-ink font-bold">Review before export</p>
              <p className="text-muted mt-1">
                Uncertain transactions stay visible so you can correct them before exporting.
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </header>
  );
}

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
import { isSoundEnabled, playSensoryCue, setSoundEnabled } from "../utils/sensoryFeedback";

export type AppPage = "home" | "workspace";

type AppHeaderProps = {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
};

export function AppHeader({ page, onNavigate }: AppHeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);

  const navigateWithFeedback = () => {
    playSensoryCue("navigation");
    onNavigate(page === "home" ? "workspace" : "home");
  };

  const toggleSound = () => {
    const nextValue = !soundEnabled;
    setSoundEnabledState(nextValue);
    setSoundEnabled(nextValue);
    if (nextValue) playSensoryCue("tap");
  };

  return (
    <header className="border-line bg-paper/90 sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="border-line text-ink flex h-9 w-9 items-center justify-center border bg-transparent font-mono text-[11px] font-bold tracking-[-0.08em]">
            AM
          </div>
          <div>
            <span className="font-display block text-[15px] font-bold tracking-[-0.04em]">
              account manager
            </span>
            <span className="text-muted font-mono text-[9px] tracking-[0.16em] uppercase">
              private finance workbench
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-muted hidden items-center gap-2 font-mono text-[10px] tracking-[0.1em] uppercase sm:flex">
            <span className="bg-moss h-1.5 w-1.5 rounded-full" />
            local mode
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute interface sounds" : "Enable interface sounds"}
            className="text-muted hover:text-ink flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors"
          >
            <Icon name={soundEnabled ? "volume" : "volumeOff"} size={14} />
            <span className="hidden sm:inline">sound {soundEnabled ? "on" : "off"}</span>
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={navigateWithFeedback}
            className="border-line bg-card text-ink hover:border-ink rounded-none px-4 font-mono text-[10px] tracking-[0.1em] uppercase shadow-none"
          >
            {page === "home" ? "Workspace" : "Home"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHelpOpen(true)}
            className="border-line bg-card text-ink hover:border-ink rounded-none px-4 font-mono text-[10px] tracking-[0.1em] uppercase shadow-none"
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

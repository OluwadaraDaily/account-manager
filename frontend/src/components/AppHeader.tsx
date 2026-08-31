import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { getGmailSession, startGmailAuthorization } from "../google/gmailAuth";
import { isSoundEnabled, playSensoryCue, setSoundEnabled } from "../utils/sensoryFeedback";

export type AppPage = "home" | "workspace";

type AppHeaderProps = {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
};

export function AppHeader({ page, onNavigate }: AppHeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [connectNudgeOpen, setConnectNudgeOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);
  const sessionQuery = useQuery({
    queryKey: ["gmail", "session"],
    queryFn: getGmailSession,
    retry: false,
  });

  const connected = sessionQuery.data?.authenticated ?? false;

  const navigateTo = (nextPage: AppPage) => {
    if (nextPage === "workspace" && !connected) {
      setConnectNudgeOpen(true);
      playSensoryCue("tap");
      return;
    }
    playSensoryCue("navigation");
    onNavigate(nextPage);
  };

  const connectGmail = () => {
    setRedirecting(true);
    startGmailAuthorization();
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
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute interface sounds" : "Enable interface sounds"}
            className="text-muted hover:text-ink flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors"
          >
            <Icon name={soundEnabled ? "volume" : "volumeOff"} size={14} />
            <span className="hidden sm:inline">sound {soundEnabled ? "on" : "off"}</span>
          </button>
          <nav aria-label="Primary navigation" className="border-line bg-card relative flex border p-0.5">
            {(["home", "workspace"] as const).map((nextPage) => (
              <Button
                key={nextPage}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigateTo(nextPage)}
                aria-current={page === nextPage ? "page" : undefined}
                className={`rounded-none px-3 font-mono text-[10px] tracking-[0.1em] uppercase shadow-none transition-colors sm:px-4 ${
                  page === nextPage
                    ? "bg-white text-black hover:bg-white"
                    : "text-muted hover:text-ink hover:bg-white/10"
                }`}
              >
                {nextPage === "home" ? "Home" : "Workspace"}
              </Button>
            ))}
            {connectNudgeOpen && !connected && (
              <div
                role="status"
                className="border-line bg-card absolute top-[calc(100%+0.75rem)] right-0 z-40 w-64 border p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
              >
                <p className="font-display text-[17px] leading-tight font-bold tracking-[-0.04em]">
                  Connect Google to open Workspace.
                </p>
                <p className="text-muted mt-2 text-[11px] leading-5">
                  Workspace uses your read-only Gmail connection to find and review transaction alerts.
                </p>
                <Button
                  type="button"
                  onClick={connectGmail}
                  disabled={redirecting || sessionQuery.isPending}
                  className="mt-3 h-auto w-full rounded-none bg-white px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-black uppercase shadow-none hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-70"
                >
                  {redirecting ? "Connecting…" : "Connect Google"}
                </Button>
              </div>
            )}
          </nav>
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
        <DialogContent className="border-line bg-card text-ink rounded-none shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
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
            <div className="border-line bg-paper border p-4">
              <p className="text-ink font-bold">Read-only Gmail access</p>
              <p className="text-muted mt-1">No bank passwords and no Gmail write actions.</p>
            </div>
            <div className="border-line bg-paper border p-4">
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

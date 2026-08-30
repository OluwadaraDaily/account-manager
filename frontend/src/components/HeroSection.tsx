import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "./Icon";
import {
  disconnectGmail,
  getGmailSession,
  startGmailAuthorization,
  type GmailSession,
} from "../google/gmailAuth";
import { playSensoryCue } from "../utils/sensoryFeedback";

export function HeroSection() {
  const queryClient = useQueryClient();
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const sessionQuery = useQuery({
    queryKey: ["gmail", "session"],
    queryFn: getGmailSession,
    retry: false,
  });
  const disconnectMutation = useMutation({
    mutationFn: disconnectGmail,
    onSuccess: () => {
      queryClient.setQueryData<GmailSession>(["gmail", "session"], {
        authenticated: false,
      });
    },
  });

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("gmail");
    if (status === "error") setAuthorizationError("Google authorization could not be completed.");
    if (status) window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const connected = sessionQuery.data?.authenticated ?? false;
  const account = sessionQuery.data?.user;
  const checkingSession = sessionQuery.isPending;
  const connecting = redirecting || disconnectMutation.isPending;
  const error =
    authorizationError ??
    (sessionQuery.error instanceof Error ? sessionQuery.error.message : null) ??
    (disconnectMutation.error instanceof Error ? disconnectMutation.error.message : null);

  const connectGmail = () => {
    setAuthorizationError(null);
    setRedirecting(true);
    playSensoryCue("tap");
    startGmailAuthorization();
  };

  const disconnect = () => {
    setAuthorizationError(null);
    playSensoryCue("tap");
    disconnectMutation.mutate();
  };

  return (
    <section className="border-line grid gap-10 border-b py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-20">
      <div className="max-w-[760px]">
        <div className="text-muted mb-7 flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] uppercase">
          <span className="bg-moss h-px w-8" />
          private by design / 001
        </div>
        <h1 className="font-display max-w-[760px] text-[clamp(3.6rem,8vw,7.8rem)] leading-[0.86] font-bold tracking-[-0.09em]">
          A clearer
          <br />
          <span className="text-moss">signal.</span>
        </h1>
        <p className="text-muted mt-8 max-w-[520px] text-[15px] leading-7">
          Turn the transaction alerts already in your inbox into a calm, reviewable record of where
          your money moved.
        </p>
      </div>
      <Card className="border-line bg-card text-ink relative rounded-none p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)] lg:ml-auto lg:max-w-[430px]">
        <div className="mb-9 flex items-start justify-between border-b border-white/10 pb-5">
          <div className="text-muted font-mono text-[10px] tracking-[0.12em] uppercase">
            connection / intake
          </div>
          <Icon name="mail" size={18} />
        </div>
        <div className="signal-rail mb-8 space-y-5 pl-7">
          <div className="flex items-center gap-3">
            <span className="signal-node" data-active="true" />
            <span className="text-ink text-[12px] font-semibold">Connect Gmail</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="signal-node" />
            <span className="text-muted text-[12px]">Find transaction alerts</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="signal-node" />
            <span className="text-muted text-[12px]">Review before export</span>
          </div>
        </div>
        <p className="font-display max-w-[300px] text-[24px] leading-[1.05] font-bold tracking-[-0.06em]">
          Connect once.
          <br />
          Keep your bearings.
        </p>
        <p className="text-muted mt-4 text-[12px] leading-6">
          Read-only Gmail access, private processing, and a spreadsheet you control.
        </p>
        <Button
          type="button"
          onClick={connected ? disconnect : connectGmail}
          disabled={checkingSession || connecting}
          className="mt-7 flex h-auto w-full items-center justify-between rounded-none bg-white px-5 py-3.5 text-[13px] font-bold text-black shadow-none transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-70"
        >
          {checkingSession
            ? "Checking Gmail…"
            : connecting
              ? connected
                ? "Disconnecting…"
                : "Connecting…"
              : connected
                ? "Disconnect Gmail"
                : "Connect Gmail"}
          <Icon name={connected ? "check" : "arrow"} size={17} />
        </Button>
        {error && <p className="text-muted mt-3 text-[12px] leading-5">{error}</p>}
        {connected && (
          <div className="text-muted mt-5 border-t border-white/10 pt-5 text-[12px] leading-5">
            Gmail connected{account?.email ? ` as ${account.email}` : ""}
          </div>
        )}
      </Card>
    </section>
  );
}

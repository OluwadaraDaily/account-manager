import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "./Icon";
import {
  disconnectGmail,
  getGmailSession,
  startGmailAuthorization,
  type GmailSession,
} from "../google/gmailAuth";

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
    startGmailAuthorization();
  };

  const disconnect = () => {
    setAuthorizationError(null);
    disconnectMutation.mutate();
  };

  return (
    <section className="border-line grid gap-8 border-b py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-16">
      <div>
        <div className="text-moss-dark mb-5 inline-flex items-center gap-2 rounded-full border border-[#dbe7ce] bg-[#eff5e8] px-3 py-1.5 text-[12px] font-semibold">
          <Icon name="shield" size={14} /> Your data stays with you
        </div>
        <h1 className="font-display max-w-[720px] text-[clamp(2.7rem,6vw,5.65rem)] leading-[0.99] font-extrabold tracking-[-0.075em]">
          See your money
          <br />
          <span className="text-moss">clearly.</span>
        </h1>
        <p className="text-muted mt-6 max-w-[560px] text-[16px] leading-7">
          Turn transaction emails into a clean, useful view of your finances. No bank passwords. No
          data stored on our servers.
        </p>
      </div>
      <div className="bg-ink rounded-[24px] p-6 text-white shadow-[0_22px_50px_rgba(24,33,29,0.12)] lg:ml-auto lg:max-w-[430px]">
        <div className="mb-10 flex items-start justify-between">
          <div className="text-lime rounded-full bg-white/10 p-3">
            <Icon name="mail" size={21} />
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/65">
            MVP preview
          </span>
        </div>
        <p className="font-display max-w-[300px] text-[22px] leading-8 font-bold tracking-[-0.04em]">
          Connect once. Understand more.
        </p>
        <p className="mt-3 text-[13px] leading-6 text-white/55">
          Read-only Gmail access, local processing, and a spreadsheet you control.
        </p>
        <button
          onClick={connected ? disconnect : connectGmail}
          disabled={checkingSession || connecting}
          className="bg-lime text-ink mt-7 flex w-full items-center justify-between rounded-full px-5 py-3.5 text-[13px] font-bold transition hover:bg-[#e6f99b] disabled:cursor-wait disabled:opacity-70"
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
        </button>
        {error && <p className="mt-3 text-[12px] leading-5 text-[#ffb4a8]">{error}</p>}
        {connected && (
          <div className="mt-5 border-t border-white/10 pt-5 text-[12px] leading-5 text-white/60">
            Gmail connected{account?.email ? ` as ${account.email}` : ""}
          </div>
        )}
      </div>
    </section>
  );
}

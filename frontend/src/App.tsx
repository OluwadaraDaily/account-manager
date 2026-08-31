import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader, type AppPage } from "./components/AppHeader";
import { LandingPage } from "./pages/LandingPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { getGmailSession } from "./google/gmailAuth";

function getPageFromLocation() {
  return window.location.pathname.replace(/\/+$/, "") === "/workspace"
    ? ("workspace" as const)
    : ("home" as const);
}

function App() {
  const [page, setPage] = useState<AppPage>(getPageFromLocation);
  const sessionQuery = useQuery({
    queryKey: ["gmail", "session"],
    queryFn: getGmailSession,
    retry: false,
  });

  useEffect(() => {
    if (page !== "workspace" || sessionQuery.isPending || sessionQuery.data?.authenticated) return;

    window.history.replaceState({}, "", "/");
    setPage("home");
  }, [page, sessionQuery.data?.authenticated, sessionQuery.isPending]);

  useEffect(() => {
    const handlePopState = () => setPage(getPageFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPage: AppPage) => {
    const nextPath = nextPage === "workspace" ? "/workspace" : "/";
    if (nextPage === "workspace" && !sessionQuery.data?.authenticated) {
      return;
    }
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader page={page} onNavigate={navigate} />
      <main className="mx-auto max-w-[1440px] px-6 pb-16 lg:px-10">
        {page === "workspace" && sessionQuery.data?.authenticated ? (
          <WorkspacePage />
        ) : (
          <LandingPage />
        )}
      </main>
    </div>
  );
}

export default App;

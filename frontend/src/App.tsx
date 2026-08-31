import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader, type AppPage } from "./components/AppHeader";
import { LandingPage } from "./pages/LandingPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { TransactionReviewPage } from "./pages/TransactionReviewPage";
import { getGmailSession } from "./google/gmailAuth";

type AppRoute = {
  page: AppPage;
  reviewJobId: string | null;
  reviewBankId: string | null;
};

function getRouteFromLocation(): AppRoute {
  const path = window.location.pathname.replace(/\/+$/, "");
  const reviewMatch = path.match(/^\/workspace\/imports\/([^/]+)$/);

  if (reviewMatch) {
    return {
      page: "workspace",
      reviewJobId: decodeURIComponent(reviewMatch[1]),
      reviewBankId: new URLSearchParams(window.location.search).get("bankId"),
    };
  }

  return {
    page: path === "/workspace" ? "workspace" : "home",
    reviewJobId: null,
    reviewBankId: null,
  };
}

function App() {
  const [route, setRoute] = useState<AppRoute>(getRouteFromLocation);
  const sessionQuery = useQuery({
    queryKey: ["gmail", "session"],
    queryFn: getGmailSession,
    retry: false,
  });

  useEffect(() => {
    if (route.page !== "workspace" || sessionQuery.isPending || sessionQuery.data?.authenticated) return;

    window.history.replaceState({}, "", "/");
    setRoute(getRouteFromLocation());
  }, [route.page, sessionQuery.data?.authenticated, sessionQuery.isPending]);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation());
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
    setRoute({ page: nextPage, reviewJobId: null, reviewBankId: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader page={route.page} onNavigate={navigate} />
      <main className="mx-auto max-w-[1440px] px-6 pb-16 lg:px-10">
        {route.page === "workspace" && sessionQuery.data?.authenticated ? (
          route.reviewJobId && route.reviewBankId ? (
            <TransactionReviewPage bankId={route.reviewBankId} importJobId={route.reviewJobId} />
          ) : (
            <WorkspacePage />
          )
        ) : (
          <LandingPage />
        )}
      </main>
    </div>
  );
}

export default App;

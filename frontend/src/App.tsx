import { useEffect, useState } from "react";
import { AppHeader, type AppPage } from "./components/AppHeader";
import { LandingPage } from "./pages/LandingPage";
import { WorkspacePage } from "./pages/WorkspacePage";

function getPageFromLocation() {
  return window.location.pathname.replace(/\/+$/, "") === "/workspace"
    ? ("workspace" as const)
    : ("home" as const);
}

function App() {
  const [page, setPage] = useState<AppPage>(getPageFromLocation);

  useEffect(() => {
    const handlePopState = () => setPage(getPageFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPage: AppPage) => {
    const nextPath = nextPage === "workspace" ? "/workspace" : "/";
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
        {page === "workspace" ? <WorkspacePage /> : <LandingPage />}
      </main>
    </div>
  );
}

export default App;

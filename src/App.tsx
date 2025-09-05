import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { Suspense, lazy } from "react";

// Critical pages loaded immediately (first load)
import Index from "./pages/Index";
import Home from "./pages/Home";
import Welcome from "./pages/Welcome";
import Onboarding from "./pages/Onboarding"; // Load immediately for OAuth

// Lazy load non-critical pages for code splitting
const QuickTask = lazy(() => import("./pages/QuickTask"));
const TaskBoard = lazy(() => import("./pages/TaskBoard"));
const Death = lazy(() => import("./pages/Death"));
const FamilyTree = lazy(() => import("./pages/FamilyTree"));
const Lab = lazy(() => import("./pages/Lab"));
const Shop = lazy(() => import("./pages/Shop"));
const Closet = lazy(() => import("./pages/Closet"));
const Stats = lazy(() => import("./pages/Stats"));
const Kiki = lazy(() => import("./pages/Kiki"));
const FriendVerification = lazy(() => import("./pages/FriendVerification"));
const BuddyReview = lazy(() => import("./pages/BuddyReview"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      staleTime: 60_000,
    },
  },
});

// Loading fallback component (mobile-first)
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/10 to-accent/20">
    <div className="text-center space-y-4">
      <div className="animate-spin text-4xl">🐱</div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/home" element={<Home />} />
              <Route path="/quick-task" element={<QuickTask />} />
              <Route path="/board" element={<TaskBoard />} />
              <Route path="/death" element={<Death />} />
              <Route path="/family-tree" element={<FamilyTree />} />
              <Route path="/lab" element={<Lab />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/closet" element={<Closet />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/kiki" element={<Kiki />} />
              <Route path="/verify/:verificationId" element={<FriendVerification />} />
              <Route path="/review" element={<BuddyReview />} />
              <Route path="/privacy" element={<PrivacySettings />} />
              <Route path="/settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

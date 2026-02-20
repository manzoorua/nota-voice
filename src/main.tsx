import * as React from "react";
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProviders } from "@/components/providers/AppProviders";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Route configuration - routes that don't require authentication but still need AuthProvider for auth functions
const AUTH_ROUTES = ['/signup', '/signin', '/forgot-password', '/reset-password', '/email-confirmation'];

// Routes that completely skip auth (no AuthProvider needed)
const PUBLIC_ROUTES = [
  '/', '/pricing', '/how-it-works', '/help', 
  '/privacy', '/terms', '/success-stories', '/payment-success', '/payment-canceled'
];

// Lazy-loaded components for code splitting
const LazyIndex = React.lazy(() => import("./pages/Index"));
const LazySignUp = React.lazy(() => import("./pages/SignUp"));
const LazySignIn = React.lazy(() => import("./pages/SignIn"));
const LazyForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const LazyResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const LazyEmailConfirmation = React.lazy(() => import("./pages/EmailConfirmation"));
const LazyAppPage = React.lazy(() => import("./pages/App"));
const LazyProfile = React.lazy(() => import("./pages/Profile"));
const LazyHowItWorks = React.lazy(() => import("./pages/HowItWorks"));
const LazyHelp = React.lazy(() => import("./pages/Help"));
const LazyPrivacy = React.lazy(() => import("./pages/Privacy"));
const LazyTerms = React.lazy(() => import("./pages/Terms"));
const LazySuccessStories = React.lazy(() => import("./pages/SuccessStories"));
const LazyAnalytics = React.lazy(() => import("./pages/Analytics"));
const LazyAdmin = React.lazy(() => import("./pages/Admin"));
const LazyBilling = React.lazy(() => import("./pages/Billing"));
const LazyPricing = React.lazy(() => import("./pages/Pricing"));
const LazyIntegrations = React.lazy(() => import("./pages/Integrations"));
const LazyArchitecture = React.lazy(() => import("./pages/Architecture"));
const LazyPaymentSuccess = React.lazy(() => import("./pages/PaymentSuccess"));
const LazyPaymentCanceled = React.lazy(() => import("./pages/PaymentCanceled"));
const LazyReferrals = React.lazy(() => import("./pages/Referrals"));
const LazyNotFound = React.lazy(() => import("./pages/NotFound"));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Pure public route component for routes that don't need auth
const PublicRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Simplified router
const Router: React.FC = () => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Route component mapping
  const getRouteComponent = () => {
    const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={<LoadingSpinner />}>
        {children}
      </React.Suspense>
    );

    // Public routes (no auth needed) and auth routes (need auth functions but no login required)
    if (PUBLIC_ROUTES.includes(currentPath) || AUTH_ROUTES.includes(currentPath)) {
      switch (currentPath) {
        case '/':
          return <SuspenseWrapper><PublicRoute><LazyIndex /></PublicRoute></SuspenseWrapper>;
        case '/signup':
          return <SuspenseWrapper><PublicRoute><LazySignUp /></PublicRoute></SuspenseWrapper>;
        case '/signin':
          return <SuspenseWrapper><PublicRoute><LazySignIn /></PublicRoute></SuspenseWrapper>;
        case '/forgot-password':
          return <SuspenseWrapper><PublicRoute><LazyForgotPassword /></PublicRoute></SuspenseWrapper>;
        case '/reset-password':
          return <SuspenseWrapper><PublicRoute><LazyResetPassword /></PublicRoute></SuspenseWrapper>;
        case '/email-confirmation':
          return <SuspenseWrapper><PublicRoute><LazyEmailConfirmation /></PublicRoute></SuspenseWrapper>;
        case '/how-it-works':
          return <SuspenseWrapper><PublicRoute><LazyHowItWorks /></PublicRoute></SuspenseWrapper>;
        case '/help':
          return <SuspenseWrapper><PublicRoute><LazyHelp /></PublicRoute></SuspenseWrapper>;
        case '/pricing':
          return <SuspenseWrapper><PublicRoute><LazyPricing /></PublicRoute></SuspenseWrapper>;
        case '/privacy':
          return <SuspenseWrapper><PublicRoute><LazyPrivacy /></PublicRoute></SuspenseWrapper>;
        case '/terms':
          return <SuspenseWrapper><PublicRoute><LazyTerms /></PublicRoute></SuspenseWrapper>;
        case '/success-stories':
          return <SuspenseWrapper><PublicRoute><LazySuccessStories /></PublicRoute></SuspenseWrapper>;
        case '/payment-success':
          return <SuspenseWrapper><PublicRoute><LazyPaymentSuccess /></PublicRoute></SuspenseWrapper>;
        case '/payment-canceled':
          return <SuspenseWrapper><PublicRoute><LazyPaymentCanceled /></PublicRoute></SuspenseWrapper>;
        default:
          return <SuspenseWrapper><PublicRoute><LazyNotFound /></PublicRoute></SuspenseWrapper>;
      }
    }

    // Protected routes (auth required)
    switch (currentPath) {
      case '/app':
        return <SuspenseWrapper><ProtectedRoute><LazyAppPage /></ProtectedRoute></SuspenseWrapper>;
      case '/profile':
        return <SuspenseWrapper><ProtectedRoute><LazyProfile /></ProtectedRoute></SuspenseWrapper>;
      case '/analytics':
        return <SuspenseWrapper><ProtectedRoute><LazyAnalytics /></ProtectedRoute></SuspenseWrapper>;
      case '/billing':
        return <SuspenseWrapper><ProtectedRoute><LazyBilling /></ProtectedRoute></SuspenseWrapper>;
      case '/integrations':
        return <SuspenseWrapper><ProtectedRoute><LazyIntegrations /></ProtectedRoute></SuspenseWrapper>;
      case '/referrals':
        return <SuspenseWrapper><ProtectedRoute><LazyReferrals /></ProtectedRoute></SuspenseWrapper>;
      case '/admin':
        return <SuspenseWrapper><ProtectedRoute requireAdmin><LazyAdmin /></ProtectedRoute></SuspenseWrapper>;
      case '/architecture':
        return <SuspenseWrapper><ProtectedRoute requireAdmin><LazyArchitecture /></ProtectedRoute></SuspenseWrapper>;
      default:
        return <SuspenseWrapper><PublicRoute><LazyNotFound /></PublicRoute></SuspenseWrapper>;
    }
  };

  return getRouteComponent();
};

const App: React.FC = () => {
  const [currentPath, setCurrentPath] = React.useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  React.useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    const handleNavigate = (e: CustomEvent) => setCurrentPath(e.detail.path);

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('navigate', handleNavigate);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('navigate', handleNavigate);
    };
  }, []);

  const isPublicRoute = PUBLIC_ROUTES.includes(currentPath);
  const isAuthRoute = AUTH_ROUTES.includes(currentPath);
  const skipAuth = isPublicRoute && !isAuthRoute;

  return (
    <AppProviders skipAuth={skipAuth}>
      <Router />
    </AppProviders>
  );
};

const container = document.getElementById("root")!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
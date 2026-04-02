import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import QueryErrorHandler from "@/components/QueryErrorHandler";
import Index from "./pages/Index";

// Lazy-loaded pages
const ChatFunnel = lazy(() => import("./pages/ChatFunnel"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const Simulator = lazy(() => import("./pages/Simulator"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminTasks = lazy(() => import("./pages/admin/AdminTasks"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminPipeline = lazy(() => import("./pages/admin/AdminPipeline"));
const AdminMetrics = lazy(() => import("./pages/admin/AdminMetrics"));
const AdminClientDetail = lazy(() => import("./pages/admin/AdminClientDetail"));
const AdminGoals = lazy(() => import("./pages/admin/AdminGoals"));
const AdminCalendar = lazy(() => import("./pages/admin/AdminCalendar"));
const AdminChatHistory = lazy(() => import("./pages/admin/AdminChatHistory"));
const AdminSimulations = lazy(() => import("./pages/admin/AdminSimulations"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog"));
const AdminSMS = lazy(() => import("./pages/admin/AdminSMS"));
const AdminSmartQueue = lazy(() => import("./pages/admin/AdminSmartQueue"));
const AdminDailyBriefing = lazy(() => import("./pages/admin/AdminDailyBriefing"));
const AdminBotPanel = lazy(() => import("./pages/admin/AdminBotPanel"));
const AdminCadenceMetrics = lazy(() => import("./pages/admin/AdminCadenceMetrics"));
const MemberArea = lazy(() => import("./pages/MemberArea"));
const PublicCatalog = lazy(() => import("./pages/PublicCatalog"));
const ProposalPage = lazy(() => import("./pages/ProposalPage"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <QueryErrorHandler />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/chat" element={<ChatFunnel />} />
                <Route path="/dashboard" element={<ClientDashboard />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/catalogo" element={<PublicCatalog />} />
                <Route path="/proposta/:id" element={<ProposalPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="leads" element={<AdminLeads />} />
                  <Route path="pipeline" element={<AdminPipeline />} />
                  <Route path="tasks" element={<AdminTasks />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="metrics" element={<AdminMetrics />} />
                  <Route path="calendar" element={<AdminCalendar />} />
                  <Route path="goals" element={<AdminGoals />} />
                  <Route path="chat-history" element={<AdminChatHistory />} />
                  <Route path="simulations" element={<AdminSimulations />} />
                  <Route path="catalog" element={<AdminCatalog />} />
                  <Route path="sms" element={<AdminSMS />} />
                  <Route path="queue" element={<AdminSmartQueue />} />
                  <Route path="briefing" element={<AdminDailyBriefing />} />
                  <Route path="bots" element={<AdminBotPanel />} />
                  <Route path="cadence-metrics" element={<AdminCadenceMetrics />} />
                  <Route path="client/:id" element={<AdminClientDetail />} />
                </Route>
                <Route
                  path="/member"
                  element={
                    <ProtectedRoute>
                      <MemberArea />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;

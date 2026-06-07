import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";

const queryClient = new QueryClient();

function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary-foreground">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-foreground">StepCheck</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Log in
            </button>
          </Link>
          <Link href="/signup">
            <button className="text-sm bg-primary text-primary-foreground rounded-md px-4 py-1.5 hover:opacity-90 transition-opacity">
              Sign up
            </button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-muted text-muted-foreground text-xs font-medium rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Step-by-step homework grading
          </div>

          <h1 className="text-5xl font-bold text-foreground leading-tight mb-4">
            Show your work.<br />Get real feedback.
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
            StepCheck grades each step of a student's work — not just the final answer — so teachers can see exactly where understanding breaks down.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="w-full sm:w-auto bg-primary text-primary-foreground rounded-lg px-6 py-3 font-medium hover:opacity-90 transition-opacity">
                Get started as a teacher
              </button>
            </Link>
            <Link href="/signup">
              <button className="w-full sm:w-auto border border-border text-foreground rounded-lg px-6 py-3 font-medium hover:bg-muted transition-colors">
                Join as a student
              </button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          {[
            {
              icon: "✏️",
              title: "Step-based problems",
              desc: "Teachers author problems with an answer key broken into graded steps.",
            },
            {
              icon: "🤖",
              title: "AI + deterministic grading",
              desc: "Each step is verified mathematically, then explained with natural-language feedback.",
            },
            {
              icon: "📊",
              title: "Per-student insight",
              desc: "Teachers see exactly which step tripped each student, not just a score.",
            },
          ].map((card) => (
            <div key={card.title} className="bg-card border border-border rounded-xl p-5 text-left">
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-foreground mb-1">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} StepCheck
      </footer>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

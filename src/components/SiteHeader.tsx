import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const link = "text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold";

export function SiteHeader() {
  const { session, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-[1000] border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="inline-block h-3 w-3 rounded-full bg-accent ring-4 ring-primary" aria-hidden />
          Civic Pulse
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-4">
          <Link to="/issues" className={link}>Issues</Link>
          <Link to="/changes" className={link}>Recent changes</Link>
          <Link to="/how-it-works" className={link}>How it works</Link>
          {isStaff && <Link to="/dashboard" className={link}>Dashboard</Link>}
          {isAdmin && <Link to="/admin" className={link}>Admin</Link>}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm"><Link to="/report">Report an issue</Link></Button>
          {session ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline"><Link to="/auth">Sign in</Link></Button>
          )}
        </div>
      </div>
    </header>
  );
}

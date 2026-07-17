import { Anchor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { InventoryBrowser } from './components/InventoryBrowser';
import { LoginForm } from './components/LoginForm';
import { Button } from './components/ui/button';
import { clearToken, getToken, setToken } from './lib/auth';

export function App() {
  const [dark, setDark] = useState(true);
  const [token, setAccessToken] = useState<string | null>(() => getToken());

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  function authenticated(nextToken: string) {
    setToken(nextToken);
    setAccessToken(nextToken);
  }

  function logout() {
    clearToken();
    setAccessToken(null);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-border bg-card p-2 text-primary">
              <Anchor aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Coastal Adventure</p>
              <h1 className="text-xl font-semibold">STOWAWAY</h1>
            </div>
          </div>
          <Button aria-label="Toggle color theme" variant="ghost" onClick={toggleTheme}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        {token ? <InventoryBrowser onLogout={logout} token={token} /> : <LoginForm onAuthenticated={authenticated} />}
      </div>
    </main>
  );
}

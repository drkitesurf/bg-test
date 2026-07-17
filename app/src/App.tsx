import { Anchor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from './components/ui/button';

export function App() {
  const [dark, setDark] = useState(true);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
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

        <section className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
          <div className="rounded-lg border border-border bg-card p-8 text-card-foreground">
            <p className="mb-3 text-sm font-medium text-primary">M0 · Foundation online</p>
            <h2 className="max-w-xl text-4xl font-semibold leading-tight">
              Your inventory should know what you will need.
            </h2>
            <p className="mt-5 max-w-xl text-muted-foreground">
              The app shell, typed API, append-only event log, and offline foundation are ready for the first
              inventory workflows.
            </p>
          </div>
          <aside className="rounded-lg border border-border bg-secondary p-6 text-secondary-foreground">
            <h3 className="font-semibold">System status</h3>
            <dl className="mt-5 grid gap-4 text-sm">
              <div className="flex justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">Interface</dt>
                <dd>Dark-first PWA</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">Storage</dt>
                <dd>D1 + R2 ready</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Credentials</dt>
                <dd>Fail closed</dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}

import { LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError, login } from '../lib/api';
import { Button } from './ui/button';

type Props = {
  onAuthenticated: (token: string) => void;
};

export function LoginForm({ onAuthenticated }: Props) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      onAuthenticated(await login(password));
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        setMessage('Server authentication is not configured.');
      } else if (error instanceof ApiError && error.status === 401) {
        setMessage('That password was not accepted.');
      } else {
        setMessage('Unable to reach the inventory service.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground">
      <span className="inline-flex rounded-lg bg-secondary p-3 text-primary">
        <LockKeyhole aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold">Open your inventory</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the password configured on this Worker. Your access token stays in this browser session.
      </p>
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input
            autoComplete="current-password"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {message ? <p className="text-sm text-muted-foreground" role="alert">{message}</p> : null}
        <Button className="min-h-11 w-full" disabled={submitting} type="submit">
          {submitting ? 'Opening…' : 'Open inventory'}
        </Button>
      </form>
    </section>
  );
}

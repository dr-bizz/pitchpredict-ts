'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState, type FormEvent } from 'react';
import { loginSchema } from '@pitchpredict/contracts';

/**
 * Login screen. Validates with the shared `loginSchema`, then calls
 * NextAuth `signIn('credentials')` (which delegates to the Nest API). On
 * success redirects to the dashboard (or the `callbackUrl` if present).
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const result = await signIn('credentials', {
      ...parsed.data,
      redirect: false,
    });
    setSubmitting(false);

    if (!result || result.error) {
      setFormError('Invalid email or password.');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={Boolean(fieldErrors['email'])}
          helperText={fieldErrors['email']}
          autoComplete="email"
          fullWidth
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(fieldErrors['password'])}
          helperText={fieldErrors['password']}
          autoComplete="current-password"
          fullWidth
          required
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting}
          fullWidth
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Link component={NextLink} href="/forgot" variant="body2">
            Forgot password?
          </Link>
          <Link component={NextLink} href="/signup" variant="body2">
            Create account
          </Link>
        </Stack>
      </Stack>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

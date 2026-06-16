'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { resetSchema } from '@pitchpredict/contracts';

/**
 * Reset-password screen. Reads the reset `token` from the URL query, validates
 * with the shared `resetSchema` (password length + confirmation match), and
 * POSTs through the BFF proxy to the Nest `/auth/reset` endpoint. On success
 * redirects to login.
 */
function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = resetSchema.safeParse({
      token,
      password,
      passwordConfirmation,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) {
          errors[key] = issue.message;
        }
      }
      if (errors['token']) {
        setFormError('This reset link is invalid. Request a new one.');
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/proxy/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setSubmitting(false);
      if (!res.ok) {
        setFormError(
          'This reset link is invalid or has expired. Request a new one.'
        );
        return;
      }
      setDone(true);
    } catch {
      setFormError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Stack spacing={2}>
        <Alert severity="success">
          Your password has been reset. You can now sign in.
        </Alert>
        <Button
          component={NextLink}
          href="/login"
          variant="contained"
          size="large"
          fullWidth
        >
          Go to sign in
        </Button>
      </Stack>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(fieldErrors['password'])}
          helperText={fieldErrors['password']}
          autoComplete="new-password"
          fullWidth
          required
        />
        <TextField
          label="Confirm new password"
          type="password"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          error={Boolean(fieldErrors['passwordConfirmation'])}
          helperText={fieldErrors['passwordConfirmation']}
          autoComplete="new-password"
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
          {submitting ? 'Resetting…' : 'Reset password'}
        </Button>
        <Link
          component={NextLink}
          href="/login"
          variant="body2"
          textAlign="center"
        >
          Back to sign in
        </Link>
      </Stack>
    </form>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}

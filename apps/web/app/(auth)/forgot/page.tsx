'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import NextLink from 'next/link';
import { useState, type FormEvent } from 'react';
import { forgotSchema } from '@pitchpredict/contracts';

/**
 * Forgot-password screen. Validates with the shared `forgotSchema` and POSTs
 * through the BFF proxy to the Nest `/auth/forgot` endpoint, which always
 * returns 200 (no account enumeration). Shows a generic confirmation.
 */
export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldError(null);

    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Invalid email');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/proxy/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setSubmitting(false);
      if (!res.ok) {
        setFormError('Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setFormError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Stack spacing={2}>
        <Alert severity="success">
          If an account exists for that email, a password reset link is on its
          way.
        </Alert>
        <Link
          component={NextLink}
          href="/login"
          variant="body2"
          textAlign="center"
        >
          Back to sign in
        </Link>
      </Stack>
    );
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
          error={Boolean(fieldError)}
          helperText={fieldError}
          autoComplete="email"
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
          {submitting ? 'Sending…' : 'Send reset link'}
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

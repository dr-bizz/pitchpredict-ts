'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, type FormEvent } from 'react';
import { registerSchema } from '@pitchpredict/contracts';

/**
 * Signup screen. Validates with the shared `registerSchema` (including the
 * password-confirmation match), POSTs to the app's own `/api/auth/register`
 * route handler, then signs the new user in and redirects to the dashboard.
 */
export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = registerSchema.safeParse({
      name,
      email,
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
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        if (res.status === 409) {
          setFieldErrors({ email: 'That email is already registered.' });
        } else {
          setFormError('Could not create your account. Please try again.');
        }
        setSubmitting(false);
        return;
      }

      const result = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      setSubmitting(false);

      if (!result || result.error) {
        setFormError('Account created, but sign-in failed. Try logging in.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setFormError('Could not create your account. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={Boolean(fieldErrors['name'])}
          helperText={fieldErrors['name']}
          autoComplete="name"
          fullWidth
          required
        />
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
          autoComplete="new-password"
          fullWidth
          required
        />
        <TextField
          label="Confirm password"
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
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
        <Link
          component={NextLink}
          href="/login"
          variant="body2"
          textAlign="center"
        >
          Already have an account? Sign in
        </Link>
      </Stack>
    </form>
  );
}

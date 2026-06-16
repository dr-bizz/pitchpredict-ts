'use client';

import LogoutIcon from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

/**
 * Sticky top bar: brand on the left; signed-in user's gold initial avatar, name
 * and sign-out on the right. Ports the Rails `application.html.erb` header.
 */
export function AppHeader() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? '';
  const initial = name.charAt(0).toUpperCase();

  return (
    <AppBar position="sticky" elevation={1} color="primary">
      <Toolbar sx={{ maxWidth: 'lg', width: '100%', mx: 'auto' }}>
        <Box
          component={Link}
          href="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'inherit',
            textDecoration: 'none',
            flexGrow: 1,
          }}
        >
          <Box
            component="span"
            sx={{ fontSize: '1.5rem', lineHeight: 1 }}
            aria-hidden
          >
            ⚽
          </Box>
          <Typography
            variant="h6"
            component="span"
            sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            PitchPredict
          </Typography>
        </Box>

        {session?.user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'secondary.main',
                  color: 'secondary.contrastText',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
                aria-hidden
              >
                {initial}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {name}
              </Typography>
            </Box>
            <Button
              color="inherit"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign out
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

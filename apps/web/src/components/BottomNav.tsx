'use client';

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HomeIcon from '@mui/icons-material/Home';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Match by prefix (e.g. Admin spans /admin/*). */
  prefix?: boolean;
}

const BASE_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <HomeIcon /> },
  { label: 'Predictions', href: '/predictions', icon: <SportsSoccerIcon /> },
  { label: 'Leaderboard', href: '/leaderboard', icon: <EmojiEventsIcon /> },
];

const ADMIN_ITEM: NavItem = {
  label: 'Admin',
  href: '/admin',
  icon: <AdminPanelSettingsIcon />,
  prefix: true,
};

/**
 * Fixed bottom navigation: Dashboard / Predictions / Leaderboard, plus Admin
 * when the signed-in user's role is `admin`.
 */
export function BottomNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const items =
    session?.user?.role === 'admin' ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

  const matches = (item: NavItem) =>
    item.prefix ? pathname.startsWith(item.href) : pathname === item.href;

  const current = items.findIndex(matches);

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (t) => t.zIndex.appBar,
      }}
    >
      <BottomNavigation showLabels value={current === -1 ? false : current}>
        {items.map((item) => (
          <BottomNavigationAction
            key={item.href}
            component={Link}
            href={item.href}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}


import { ThemeConfig } from '../types/themeConfig';
import { AlertTriangle, Shield, Users, TrendingDown } from 'lucide-react';

export const defaultTheme: ThemeConfig = {
  colors: {
    risk: {
      liquidatable: 'hsl(var(--destructive))',
      danger: 'hsl(var(--accent))',
      moderate: 'hsl(var(--warning-orange))',
      safe: 'hsl(var(--ocean-teal))',
    },
    background: {
      primary: 'hsl(var(--background))',
      secondary: 'hsl(var(--muted))',
      card: 'hsl(var(--card))',
    },
    text: {
      primary: 'hsl(var(--foreground))',
      secondary: 'hsl(var(--muted-foreground))',
      accent: 'hsl(var(--accent-foreground))',
    },
    border: 'hsl(var(--border))',
    accent: 'hsl(var(--accent))',
  },
  typography: {
    fontFamily: 'font-poppins',
    fontSize: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
    },
    fontWeight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
  spacing: {
    xs: '2',
    sm: '4',
    md: '6',
    lg: '8',
    xl: '12',
  },
  borderRadius: {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
  },
  layout: {
    variant: 'cards',
    showIcons: true,
    showAvatars: true,
    compactMode: false,
  },
  icons: {
    type: 'lucide',
    risk: {
      liquidatable: AlertTriangle,
      danger: TrendingDown,
      moderate: Users,
      safe: Shield,
    },
    actions: {
      search: '🔍',
      sort: '↕️',
      filter: '🔽',
    },
  },
};

export const corporateTheme: ThemeConfig = {
  ...defaultTheme,
  colors: {
    risk: {
      liquidatable: '#dc2626',
      danger: '#ea580c',
      moderate: '#eab308',
      safe: '#16a34a',
    },
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      card: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
      accent: '#0f172a',
    },
    border: '#e2e8f0',
    accent: '#3b82f6',
  },
  layout: {
    variant: 'table',
    showIcons: false,
    showAvatars: false,
    compactMode: true,
  },
  icons: {
    type: 'emoji',
    risk: {
      liquidatable: '🔴',
      danger: '🟠',
      moderate: '🟡',
      safe: '🟢',
    },
    actions: {
      search: '🔍',
      sort: '↕️',
      filter: '🔽',
    },
  },
};

export const cryptoTheme: ThemeConfig = {
  ...defaultTheme,
  colors: {
    risk: {
      liquidatable: '#ff0040',
      danger: '#ff6b00',
      moderate: '#ffdd00',
      safe: '#00ff88',
    },
    background: {
      primary: '#0a0a0a',
      secondary: '#1a1a1a',
      card: '#1f1f1f',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a0a0a0',
      accent: '#00ff88',
    },
    border: '#333333',
    accent: '#00ff88',
  },
  typography: {
    ...defaultTheme.typography,
    fontFamily: 'font-mono',
  },
  layout: {
    variant: 'dashboard',
    showIcons: true,
    showAvatars: true,
    compactMode: false,
  },
};

export const mobileTheme: ThemeConfig = {
  ...defaultTheme,
  layout: {
    variant: 'mobile',
    showIcons: true,
    showAvatars: false,
    compactMode: true,
  },
  spacing: {
    xs: '1',
    sm: '2',
    md: '3',
    lg: '4',
    xl: '6',
  },
};

export const getTheme = (variant?: string): ThemeConfig => {
  switch (variant) {
    case 'corporate':
      return corporateTheme;
    case 'crypto':
      return cryptoTheme;
    case 'mobile':
      return mobileTheme;
    default:
      return defaultTheme;
  }
};


export interface ThemeConfig {
  colors: {
    risk: {
      liquidatable: string;
      danger: string;
      moderate: string;
      safe: string;
    };
    background: {
      primary: string;
      secondary: string;
      card: string;
    };
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    border: string;
    accent: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  layout: {
    variant: 'table' | 'cards' | 'dashboard' | 'mobile';
    showIcons: boolean;
    showAvatars: boolean;
    compactMode: boolean;
  };
  icons: {
    type: 'lucide' | 'emoji' | 'custom';
    risk: {
      liquidatable: string | React.ComponentType;
      danger: string | React.ComponentType;
      moderate: string | React.ComponentType;
      safe: string | React.ComponentType;
    };
    actions: {
      search: string | React.ComponentType;
      sort: string | React.ComponentType;
      filter: string | React.ComponentType;
    };
  };
}

export interface ComponentThemeProps {
  theme?: Partial<ThemeConfig>;
  variant?: 'default' | 'corporate' | 'crypto' | 'minimal' | 'mobile';
  className?: string;
}

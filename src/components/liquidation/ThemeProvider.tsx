
import React, { createContext, useContext } from 'react';
import { ThemeConfig, ComponentThemeProps } from '../../types/themeConfig';
import { getTheme } from '../../themes/liquidationThemes';

type ThemeVariant = 'default' | 'corporate' | 'crypto' | 'minimal' | 'mobile';

interface ThemeContextType {
  theme: ThemeConfig;
  variant: ThemeVariant;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  variant?: ThemeVariant;
  customTheme?: Partial<ThemeConfig>;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  variant = 'default',
  customTheme,
}) => {
  const baseTheme = getTheme(variant);
  const theme = { ...baseTheme, ...customTheme };

  return (
    <ThemeContext.Provider value={{ theme, variant }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const withTheme = <P extends object>(
  Component: React.ComponentType<P & ComponentThemeProps>
) => {
  return (props: P) => {
    const { theme, variant } = useTheme();
    return <Component {...props} theme={theme} variant={variant} />;
  };
};

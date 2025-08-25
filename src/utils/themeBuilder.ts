
import { ThemeConfig } from '../types/themeConfig';
import { defaultTheme } from '../themes/liquidationThemes';

export class ThemeBuilder {
  private config: ThemeConfig;

  constructor(baseTheme: ThemeConfig = defaultTheme) {
    this.config = JSON.parse(JSON.stringify(baseTheme));
  }

  static create(baseTheme?: ThemeConfig): ThemeBuilder {
    return new ThemeBuilder(baseTheme);
  }

  colors(colors: Partial<ThemeConfig['colors']>): ThemeBuilder {
    this.config.colors = { ...this.config.colors, ...colors };
    return this;
  }

  riskColors(risk: Partial<ThemeConfig['colors']['risk']>): ThemeBuilder {
    this.config.colors.risk = { ...this.config.colors.risk, ...risk };
    return this;
  }

  backgroundColors(background: Partial<ThemeConfig['colors']['background']>): ThemeBuilder {
    this.config.colors.background = { ...this.config.colors.background, ...background };
    return this;
  }

  textColors(text: Partial<ThemeConfig['colors']['text']>): ThemeBuilder {
    this.config.colors.text = { ...this.config.colors.text, ...text };
    return this;
  }

  typography(typography: Partial<ThemeConfig['typography']>): ThemeBuilder {
    this.config.typography = { ...this.config.typography, ...typography };
    return this;
  }

  spacing(spacing: Partial<ThemeConfig['spacing']>): ThemeBuilder {
    this.config.spacing = { ...this.config.spacing, ...spacing };
    return this;
  }

  layout(layout: Partial<ThemeConfig['layout']>): ThemeBuilder {
    this.config.layout = { ...this.config.layout, ...layout };
    return this;
  }

  icons(icons: Partial<ThemeConfig['icons']>): ThemeBuilder {
    this.config.icons = { ...this.config.icons, ...icons };
    return this;
  }

  borderRadius(borderRadius: Partial<ThemeConfig['borderRadius']>): ThemeBuilder {
    this.config.borderRadius = { ...this.config.borderRadius, ...borderRadius };
    return this;
  }

  build(): ThemeConfig {
    return this.config;
  }
}

// Utility functions for common theme modifications
export const createDarkTheme = (baseTheme: ThemeConfig): ThemeConfig => {
  return ThemeBuilder.create(baseTheme)
    .backgroundColors({
      primary: '#000000',
      secondary: '#1a1a1a',
      card: '#2a2a2a',
    })
    .textColors({
      primary: '#ffffff',
      secondary: '#a0a0a0',
      accent: '#ffffff',
    })
    .colors({
      border: '#333333',
    })
    .build();
};

export const createHighContrastTheme = (baseTheme: ThemeConfig): ThemeConfig => {
  return ThemeBuilder.create(baseTheme)
    .riskColors({
      liquidatable: '#ff0000',
      danger: '#ff8800',
      moderate: '#ffdd00',
      safe: '#00ff00',
    })
    .build();
};

export const createCompactTheme = (baseTheme: ThemeConfig): ThemeBuilder => {
  return ThemeBuilder.create(baseTheme)
    .spacing({
      xs: '1',
      sm: '2',
      md: '3',
      lg: '4',
      xl: '6',
    })
    .layout({
      ...baseTheme.layout,
      compactMode: true,
    });
};

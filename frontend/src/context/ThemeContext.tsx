import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme type definitions
export interface ThemeColors {
  // Backgrounds
  bg: string;
  bgSecondary: string;
  surface: string;
  glass: string;
  
  // Borders
  border: string;
  borderLight: string;
  
  // Text
  text: string;
  textDim: string;
  textMute: string;
  
  // Accents
  primary: string;
  primaryDim: string;
  secondary: string;
  
  // Status
  success: string;
  warning: string;
  danger: string;
  info: string;
  
  // Brand
  apple: string;
  samsung: string;
  
  // Gradients
  gradientStart: string;
  gradientEnd: string;
}

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  isDark: boolean;
  colors: ThemeColors;
}

// Soothing, eye-friendly preset themes
export const PRESET_THEMES: Record<string, Theme> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    emoji: '🌙',
    isDark: true,
    colors: {
      bg: '#0A0A0F',
      bgSecondary: '#0F0F16',
      surface: '#12121A',
      glass: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.08)',
      borderLight: 'rgba(255,255,255,0.12)',
      text: '#F1F5F9',
      textDim: '#94A3B8',
      textMute: '#64748B',
      primary: '#2DD4BF',
      primaryDim: 'rgba(45,212,191,0.15)',
      secondary: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
      apple: '#E5E7EB',
      samsung: '#60A5FA',
      gradientStart: '#2DD4BF',
      gradientEnd: '#10B981',
    },
  },
  daylight: {
    id: 'daylight',
    name: 'Daylight',
    emoji: '☀️',
    isDark: false,
    colors: {
      bg: '#F8FAFC',
      bgSecondary: '#F1F5F9',
      surface: '#FFFFFF',
      glass: 'rgba(0,0,0,0.02)',
      border: 'rgba(0,0,0,0.08)',
      borderLight: 'rgba(0,0,0,0.05)',
      text: '#0F172A',
      textDim: '#475569',
      textMute: '#94A3B8',
      primary: '#0D9488',
      primaryDim: 'rgba(13,148,136,0.12)',
      secondary: '#7C3AED',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#2563EB',
      apple: '#1F2937',
      samsung: '#2563EB',
      gradientStart: '#0D9488',
      gradientEnd: '#059669',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    isDark: true,
    colors: {
      bg: '#1A1210',
      bgSecondary: '#1F1614',
      surface: '#261C18',
      glass: 'rgba(255,200,150,0.04)',
      border: 'rgba(255,180,120,0.12)',
      borderLight: 'rgba(255,180,120,0.18)',
      text: '#FEF3E2',
      textDim: '#D4A574',
      textMute: '#A67C52',
      primary: '#FB923C',
      primaryDim: 'rgba(251,146,60,0.15)',
      secondary: '#F472B6',
      success: '#4ADE80',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#60A5FA',
      apple: '#FEF3E2',
      samsung: '#60A5FA',
      gradientStart: '#FB923C',
      gradientEnd: '#F472B6',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    isDark: true,
    colors: {
      bg: '#0A1628',
      bgSecondary: '#0D1B2A',
      surface: '#112240',
      glass: 'rgba(100,200,255,0.04)',
      border: 'rgba(100,180,255,0.12)',
      borderLight: 'rgba(100,180,255,0.18)',
      text: '#E2E8F0',
      textDim: '#7DD3FC',
      textMute: '#38BDF8',
      primary: '#22D3EE',
      primaryDim: 'rgba(34,211,238,0.15)',
      secondary: '#818CF8',
      success: '#34D399',
      warning: '#FCD34D',
      danger: '#FB7185',
      info: '#60A5FA',
      apple: '#E2E8F0',
      samsung: '#60A5FA',
      gradientStart: '#22D3EE',
      gradientEnd: '#3B82F6',
    },
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst',
    emoji: '🍇',
    isDark: true,
    colors: {
      bg: '#13091C',
      bgSecondary: '#1A0F24',
      surface: '#221432',
      glass: 'rgba(180,150,255,0.04)',
      border: 'rgba(180,150,255,0.12)',
      borderLight: 'rgba(180,150,255,0.18)',
      text: '#F3E8FF',
      textDim: '#C4B5FD',
      textMute: '#A78BFA',
      primary: '#A855F7',
      primaryDim: 'rgba(168,85,247,0.15)',
      secondary: '#EC4899',
      success: '#4ADE80',
      warning: '#FBBF24',
      danger: '#FB7185',
      info: '#818CF8',
      apple: '#F3E8FF',
      samsung: '#818CF8',
      gradientStart: '#A855F7',
      gradientEnd: '#EC4899',
    },
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    isDark: true,
    colors: {
      bg: '#0A1410',
      bgSecondary: '#0F1A14',
      surface: '#14251C',
      glass: 'rgba(100,255,150,0.04)',
      border: 'rgba(100,220,130,0.12)',
      borderLight: 'rgba(100,220,130,0.18)',
      text: '#ECFDF5',
      textDim: '#86EFAC',
      textMute: '#4ADE80',
      primary: '#22C55E',
      primaryDim: 'rgba(34,197,94,0.15)',
      secondary: '#2DD4BF',
      success: '#4ADE80',
      warning: '#FCD34D',
      danger: '#FB7185',
      info: '#60A5FA',
      apple: '#ECFDF5',
      samsung: '#60A5FA',
      gradientStart: '#22C55E',
      gradientEnd: '#2DD4BF',
    },
  },
  rose: {
    id: 'rose',
    name: 'Rose Gold',
    emoji: '🌸',
    isDark: false,
    colors: {
      bg: '#FFF5F5',
      bgSecondary: '#FFF0F0',
      surface: '#FFFFFF',
      glass: 'rgba(255,100,150,0.04)',
      border: 'rgba(200,100,130,0.12)',
      borderLight: 'rgba(200,100,130,0.08)',
      text: '#4A1D34',
      textDim: '#9D4567',
      textMute: '#C77D99',
      primary: '#E11D48',
      primaryDim: 'rgba(225,29,72,0.12)',
      secondary: '#EC4899',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#2563EB',
      apple: '#4A1D34',
      samsung: '#2563EB',
      gradientStart: '#E11D48',
      gradientEnd: '#EC4899',
    },
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    emoji: '🪨',
    isDark: false,
    colors: {
      bg: '#F1F5F9',
      bgSecondary: '#E2E8F0',
      surface: '#FFFFFF',
      glass: 'rgba(0,0,0,0.02)',
      border: 'rgba(0,0,0,0.08)',
      borderLight: 'rgba(0,0,0,0.05)',
      text: '#1E293B',
      textDim: '#475569',
      textMute: '#94A3B8',
      primary: '#475569',
      primaryDim: 'rgba(71,85,105,0.12)',
      secondary: '#6366F1',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#2563EB',
      apple: '#1E293B',
      samsung: '#2563EB',
      gradientStart: '#475569',
      gradientEnd: '#6366F1',
    },
  },
};

export type ThemeMode = 'auto' | 'light' | 'dark' | 'system' | 'schedule';

interface ThemeContextType {
  theme: Theme;
  themeId: string;
  themeMode: ThemeMode;
  setThemeId: (id: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  availableThemes: Theme[];
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_THEME = '@healthbridge_theme';
const STORAGE_KEY_MODE = '@healthbridge_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeId, setThemeIdState] = useState<string>('midnight');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedTheme, savedMode] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_MODE),
        ]);
        if (savedTheme && PRESET_THEMES[savedTheme]) {
          setThemeIdState(savedTheme);
        }
        if (savedMode) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (e) {
        console.warn('Failed to load theme preferences:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadPreferences();
  }, []);

  // Determine if we should use dark mode based on mode setting
  const shouldUseDarkMode = useCallback((): boolean => {
    switch (themeMode) {
      case 'dark':
        return true;
      case 'light':
        return false;
      case 'system':
        return systemColorScheme === 'dark';
      case 'schedule':
        // Dark mode between 7 PM and 7 AM
        const hour = new Date().getHours();
        return hour >= 19 || hour < 7;
      case 'auto':
      default:
        // Combine system preference with time of day
        if (systemColorScheme === 'dark') return true;
        const h = new Date().getHours();
        return h >= 20 || h < 6;
    }
  }, [themeMode, systemColorScheme]);

  // Get the actual theme to use
  const getActiveTheme = useCallback((): Theme => {
    const selectedTheme = PRESET_THEMES[themeId] || PRESET_THEMES.midnight;
    const wantsDark = shouldUseDarkMode();
    
    // If mode is manual (dark/light), we might need to switch themes
    if (themeMode === 'dark' && !selectedTheme.isDark) {
      // User wants dark but selected a light theme - find dark equivalent
      return PRESET_THEMES.midnight;
    }
    if (themeMode === 'light' && selectedTheme.isDark) {
      // User wants light but selected a dark theme - find light equivalent
      return PRESET_THEMES.daylight;
    }
    
    // For auto/system/schedule modes with explicit theme selection
    if ((themeMode === 'auto' || themeMode === 'system' || themeMode === 'schedule') && 
        selectedTheme.isDark !== wantsDark) {
      // Switch to appropriate theme based on time/system
      return wantsDark ? PRESET_THEMES.midnight : PRESET_THEMES.daylight;
    }
    
    return selectedTheme;
  }, [themeId, themeMode, shouldUseDarkMode]);

  const setThemeId = useCallback(async (id: string) => {
    if (PRESET_THEMES[id]) {
      setThemeIdState(id);
      try {
        await AsyncStorage.setItem(STORAGE_KEY_THEME, id);
      } catch (e) {
        console.warn('Failed to save theme:', e);
      }
    }
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch (e) {
      console.warn('Failed to save theme mode:', e);
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Force re-render when system theme changes
      if (themeMode === 'system' || themeMode === 'auto') {
        setThemeIdState(prev => prev); // Trigger re-render
      }
    });
    return () => subscription.remove();
  }, [themeMode]);

  // Schedule-based auto-update
  useEffect(() => {
    if (themeMode === 'schedule' || themeMode === 'auto') {
      const interval = setInterval(() => {
        setThemeIdState(prev => prev); // Trigger re-render to check time
      }, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [themeMode]);

  const theme = getActiveTheme();
  const availableThemes = Object.values(PRESET_THEMES);

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId,
        themeMode,
        setThemeId,
        setThemeMode,
        availableThemes,
        isDark: theme.isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper to get spacing values
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Helper to get border radius values
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

// Export default theme for initial render
export const defaultTheme = PRESET_THEMES.midnight;

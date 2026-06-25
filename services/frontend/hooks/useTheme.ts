'use client';

import { useContext } from 'react';
import { ThemeContext } from '@/components/theme-provider';

export const useTheme = () => useContext(ThemeContext);
'use client'

import { useTheme } from 'next-themes'
import { dark, light, type TrailPalette } from './colors'

export function useColors(): TrailPalette {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'light' ? light : dark
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Helper de composition de classes Tailwind (clsx + résolution des conflits).
// À utiliser dans tous les composants du nouveau Design System.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

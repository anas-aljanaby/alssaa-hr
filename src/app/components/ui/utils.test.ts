import { describe, it, expect } from 'vitest'
import { cn } from '@/app/components/ui/utils'

describe('cn()', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('tailwind-merge deduplicates conflicting utilities', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes via clsx', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})

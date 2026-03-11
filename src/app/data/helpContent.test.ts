import { describe, it, expect } from 'vitest';
import { helpCategories, SUPPORT_EMAIL, type HelpCategory } from '@/app/data/helpContent';

describe('helpContent', () => {
  it('exports a non-empty array of categories', () => {
    expect(helpCategories.length).toBeGreaterThan(0);
  });

  it.each(helpCategories.map((c) => [c.id, c] as [string, HelpCategory]))(
    'category "%s" has required fields',
    (_id, category) => {
      expect(category.id).toBeTruthy();
      expect(category.titleAr).toBeTruthy();
      expect(category.items.length).toBeGreaterThan(0);
    },
  );

  it('every help item has non-empty titleAr and bodyAr', () => {
    for (const cat of helpCategories) {
      for (const item of cat.items) {
        expect(item.titleAr, `Missing titleAr in ${cat.id}`).toBeTruthy();
        expect(item.bodyAr, `Missing bodyAr in ${cat.id}`).toBeTruthy();
      }
    }
  });

  it('every link has non-empty labelAr and path starting with /', () => {
    for (const cat of helpCategories) {
      for (const item of cat.items) {
        if (item.link) {
          expect(item.link.labelAr).toBeTruthy();
          expect(item.link.path).toMatch(/^\//);
        }
      }
    }
  });

  it('has unique category ids', () => {
    const ids = helpCategories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('SUPPORT_EMAIL looks like a valid email', () => {
    expect(SUPPORT_EMAIL).toMatch(/.+@.+\..+/);
  });
});

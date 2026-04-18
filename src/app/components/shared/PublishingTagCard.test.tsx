import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishingTagCard } from './PublishingTagCard';

const claimedHolder = {
  id: 'tag-1',
  org_id: 'org-1',
  user_id: 'user-1',
  claimed_at: '2026-04-17T08:00:00.000Z',
  released_at: null,
  force_released_by: null,
  force_released_at: null,
  claim_status: 'claimed' as const,
  holder_profile: {
    id: 'user-1',
    name_ar: 'سارة',
    avatar_url: null,
    department: { name_ar: 'الموارد البشرية' },
  },
  force_released_by_profile: null,
};

describe('PublishingTagCard', () => {
  it('shows the unclaimed state with an enabled claim button', () => {
    render(<PublishingTagCard holder={null} currentUserId="user-1" onClaim={vi.fn()} />);

    expect(screen.getByText('لا يوجد ناشر معين حالياً')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'أخذ وسم الناشر' })).toBeEnabled();
  });

  it('shows the release action when the current user holds the tag', () => {
    render(
      <PublishingTagCard
        holder={claimedHolder}
        currentUserId="user-1"
        onRelease={vi.fn()}
      />
    );

    expect(screen.getByText('سارة')).toBeInTheDocument();
    expect(screen.getByText('القسم الحالي: الموارد البشرية')).toBeInTheDocument();
    expect(screen.queryByText('EMP-001')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'التنازل عن الوسم' })).toBeEnabled();
  });

  it('disables claiming when another user holds the tag and shows the admin action', () => {
    render(
      <PublishingTagCard
        holder={{ ...claimedHolder, user_id: 'user-2' }}
        currentUserId="user-1"
        showForceRelease={true}
        onClaim={vi.fn()}
        onForceRelease={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'أخذ وسم الناشر' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'إلغاء الوسم' })).toBeEnabled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPill } from '../../../src/client/ui/TagPill';

describe('TagPill', () => {
  it('renders as static text when no onClick is given', () => {
    render(<TagPill tag="Cliente Acme" />);
    expect(screen.getByText('Cliente Acme')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders as a clickable button when onClick is given', async () => {
    const onClick = vi.fn();
    render(<TagPill tag="Cliente Acme" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Cliente Acme/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

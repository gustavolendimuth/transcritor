import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from '../../../src/client/ui/Combobox';

function ControlledCombobox({ options }: { options: string[] }) {
  const [value, setValue] = useState('');
  return <Combobox id="tag" value={value} onChange={setValue} options={options} placeholder="Ex.: Cliente Acme" />;
}

describe('Combobox', () => {
  it('filters options as the user types', async () => {
    render(<ControlledCombobox options={['Cliente Acme', 'Cliente Beta', 'Interno']} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'acm');
    expect(screen.getByRole('option', { name: /Cliente Acme/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Interno/ })).not.toBeInTheDocument();
  });

  it('selects an option on click and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Combobox id="tag" value="" onChange={onChange} options={['Cliente Acme']} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /Cliente Acme/ }));
    expect(onChange).toHaveBeenCalledWith('Cliente Acme');
  });

  it('navigates with ArrowDown and selects with Enter', async () => {
    const onChange = vi.fn();
    render(<Combobox id="tag" value="" onChange={onChange} options={['Cliente Acme', 'Cliente Beta']} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('Cliente Acme');
  });

  it('closes the list on Escape', async () => {
    render(<ControlledCombobox options={['Cliente Acme']} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByRole('option', { name: /Cliente Acme/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option', { name: /Cliente Acme/ })).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

function Greeting() {
  return <p className="text-ctp-mauve">Hello, Transcritor</p>;
}

describe('React + Testing Library wiring', () => {
  it('renders a component and finds it by text', () => {
    render(<Greeting />);
    expect(screen.getByText('Hello, Transcritor')).toBeInTheDocument();
  });
});

import { Waveform } from './Waveform';
import { Button } from './Button';

export function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="flex items-center justify-between py-3 sm:py-4 mb-2">
      <div className="flex items-center gap-2">
        <Waveform />
        <h1 className="font-display text-2xl -tracking-[0.01em]">Transcritor</h1>
      </div>
      <Button variant="ghost" onClick={onLogout}>
        Sair
      </Button>
    </header>
  );
}

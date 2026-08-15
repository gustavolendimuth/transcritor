import { Spinner } from './Spinner';

export function BootLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ctp-base z-20">
      <Spinner size="lg" />
    </div>
  );
}

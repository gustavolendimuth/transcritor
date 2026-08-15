const BAR_HEIGHTS = ['40%', '80%', '100%', '60%', '30%'];
const BAR_DELAYS = ['-1.1s', '-0.9s', '-0.7s', '-0.5s', '-0.3s'];

export function Waveform({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] h-5 ${className}`} aria-hidden="true">
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="w-[3px] rounded-sm bg-ctp-mauve waveform-bar"
          style={{ height, animationDelay: BAR_DELAYS[index] }}
        />
      ))}
    </span>
  );
}

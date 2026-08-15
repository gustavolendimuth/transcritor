import { useMemo, useState, type KeyboardEvent } from 'react';
import { tagColorVar } from '../lib/tagColor';

export interface ComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function Combobox({ id, value, onChange, options, placeholder }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query ? options.filter((tag) => tag.toLowerCase().includes(query)) : options;
  }, [options, value]);

  function open() {
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function select(tag: string) {
    onChange(tag);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') open();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        select(filtered[activeIndex]);
      } else {
        close();
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      close();
    }
  }

  const dotStyle = { '--tag-color': value ? tagColorVar(value) : undefined } as React.CSSProperties;

  return (
    <div className="relative w-full flex items-center gap-2 bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 focus-within:border-ctp-mauve">
      <span
        style={dotStyle}
        className="w-[9px] h-[9px] rounded-full bg-[var(--tag-color,#6c7086)] flex-shrink-0"
        aria-hidden="true"
      />
      <input
        id={id}
        role="combobox"
        type="text"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          open();
        }}
        onFocus={open}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 bg-transparent border-none py-2.5 text-[0.9375rem] text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 right-0 z-10 m-0 p-1 max-h-56 overflow-y-auto list-none bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-2xl"
        >
          {filtered.map((tag, index) => (
            <li
              key={tag}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                select(tag);
              }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-[0.9375rem] text-ctp-text cursor-pointer truncate ${
                index === activeIndex ? 'bg-ctp-surface1' : ''
              }`}
            >
              <span
                style={{ '--tag-color': tagColorVar(tag) } as React.CSSProperties}
                className="w-2 h-2 rounded-full bg-[var(--tag-color)] flex-shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{tag}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

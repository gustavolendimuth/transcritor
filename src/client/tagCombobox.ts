import { applyTagColor } from './tagColor.js';

export interface TagComboboxController {
  refreshOptions(): void;
}

export function createTagCombobox(
  input: HTMLInputElement,
  dot: HTMLElement,
  listbox: HTMLUListElement,
  getAllTags: () => string[]
): TagComboboxController {
  let activeIndex = -1;
  let currentOptions: string[] = [];

  function updateDot() {
    applyTagColor(dot, input.value.trim() || null);
  }

  function closeList() {
    listbox.hidden = true;
    listbox.innerHTML = '';
    currentOptions = [];
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function setActive(index: number) {
    const options = listbox.querySelectorAll('.tag-combobox-option');
    options.forEach((option) => option.classList.remove('is-active'));
    if (index >= 0 && index < options.length) {
      const el = options[index] as HTMLElement;
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', el.id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
    activeIndex = index;
  }

  function selectTag(tag: string) {
    input.value = tag;
    updateDot();
    closeList();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  function renderOptions(filter: string) {
    const query = filter.trim().toLowerCase();
    const tags = getAllTags();
    currentOptions = query ? tags.filter((tag) => tag.toLowerCase().includes(query)) : tags;
    listbox.innerHTML = '';
    activeIndex = -1;

    if (currentOptions.length === 0) {
      closeList();
      return;
    }

    currentOptions.forEach((tag, index) => {
      const option = document.createElement('li');
      option.className = 'tag-combobox-option';
      option.id = `${listbox.id}-option-${index}`;
      option.setAttribute('role', 'option');

      const optionDot = document.createElement('span');
      optionDot.className = 'tag-dot';
      applyTagColor(optionDot, tag);

      const optionName = document.createElement('span');
      optionName.className = 'tag-combobox-option-name';
      optionName.textContent = tag;

      option.append(optionDot, optionName);
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        selectTag(tag);
      });
      listbox.append(option);
    });

    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('focus', () => renderOptions(input.value));
  input.addEventListener('input', () => {
    updateDot();
    renderOptions(input.value);
  });
  input.addEventListener('keydown', (event) => {
    if (listbox.hidden) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') renderOptions(input.value);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, currentOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0) {
        event.preventDefault();
        selectTag(currentOptions[activeIndex]);
      } else {
        closeList();
      }
    } else if (event.key === 'Escape') {
      closeList();
    } else if (event.key === 'Tab') {
      closeList();
    }
  });
  input.addEventListener('blur', () => closeList());

  updateDot();

  return {
    refreshOptions() {
      updateDot();
      if (!listbox.hidden) renderOptions(input.value);
    },
  };
}

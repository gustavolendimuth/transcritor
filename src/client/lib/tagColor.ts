const TAG_COLOR_COUNT = 8;

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return hash % TAG_COLOR_COUNT;
}

export function tagColorVar(tag: string): string {
  return `var(--tag-color-${hashTag(tag)})`;
}

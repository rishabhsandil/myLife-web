export const NOTE_COLORS: { name: string; value: string }[] = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Yellow', value: '#FFF176' },
  { name: 'Pink', value: '#F48FB1' },
  { name: 'Purple', value: '#CE93D8' },
  { name: 'Blue', value: '#81D4FA' },
  { name: 'Green', value: '#AED581' },
  { name: 'Orange', value: '#FFB74D' },
];

/** Strips HTML tags and returns up to 100 chars of plain text from a note body. */
export function getPreviewText(content: string): string {
  if (!content) return 'No additional text';
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
  if (!plainText) return 'No additional text';
  return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
}

/** Relative time formatting for note timestamps. */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

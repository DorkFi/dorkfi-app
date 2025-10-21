/**
 * Utility functions for formatting timestamps and dates
 */

/**
 * Formats a timestamp (Unix time in seconds) to a user-friendly relative time string
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted relative time string (e.g., "2 hours ago", "1 day ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - (timestamp * 1000); // Convert to milliseconds
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (weeks < 4) {
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  } else if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Formats a timestamp to a readable date and time string
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted date string (e.g., "Jan 15, 2024 at 10:30 AM")
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formats a timestamp to a short date string
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted short date string (e.g., "Jan 15, 2024")
 */
export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats an ISO string timestamp to a user-friendly relative time string
 * @param isoString ISO timestamp string
 * @returns Formatted relative time string
 */
export function formatRelativeTimeFromISO(isoString: string): string {
  const timestamp = Math.floor(new Date(isoString).getTime() / 1000);
  return formatRelativeTime(timestamp);
}

/**
 * Formats an ISO string timestamp to a readable date and time string
 * @param isoString ISO timestamp string
 * @returns Formatted date string
 */
export function formatDateTimeFromISO(isoString: string): string {
  const timestamp = Math.floor(new Date(isoString).getTime() / 1000);
  return formatDateTime(timestamp);
}

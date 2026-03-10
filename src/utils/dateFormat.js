/**
 * Date formatting utilities for IST (Indian Standard Time)
 * Timezone: Asia/Kolkata (UTC+5:30)
 */

/**
 * Format date to IST locale string
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string in IST
 */
export const toISTString = (date) => {
  if (!date) return '—';
  
  try {
    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return '—';
  }
};

/**
 * Format date to IST date only (no time)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string in IST
 */
export const toISTDateString = (date) => {
  if (!date) return '—';
  
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return '—';
  }
};

/**
 * Format date to IST time only (no date)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted time string in IST
 */
export const toISTTimeString = (date) => {
  if (!date) return '—';
  
  try {
    return new Date(date).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting time to IST:', error);
    return '—';
  }
};

/**
 * Format date to compact IST date (DD MMM YYYY)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string in IST
 */
export const toISTCompactDate = (date) => {
  if (!date) return '—';
  
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return '—';
  }
};

/**
 * Format date to IST with custom month-year format
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string in IST (MMM YYYY)
 */
export const toISTMonthYear = (date) => {
  if (!date) return '—';
  
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return '—';
  }
};

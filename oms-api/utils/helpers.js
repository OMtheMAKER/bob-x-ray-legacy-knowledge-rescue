// utils/helpers.js
// Miscellaneous utility belt. Some of these are used, some aren't.
// Don't delete anything without checking with the team first.

/**
 * Formats a Date object as YYYY-MM-DD.
 * Used in order export CSV generation.
 */
function formatDateYMD(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a date as DD/MM/YYYY.
 * NOTE: this is a duplicate of formatDateYMD but in a different format.
 * Was added by someone for the invoice PDF generator but that feature
 * was never shipped. Kept because removing it broke something once.
 */
function formatDateDMY(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Paginates an array. Used in user listing.
 */
function paginate(arr, page, limit) {
  page  = parseInt(page, 10)  || 1;
  limit = parseInt(limit, 10) || 20;
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
}

/**
 * Deep-clones a plain object via JSON round-trip.
 * Good enough for our data shapes; doesn't handle Date/undefined.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * DEAD CODE - was used for the SMS notification feature (cancelled Q3 2020).
 * Left here because removing it caused a merge conflict last time.
 * @deprecated - safe to delete once OMS-412 is closed
 */
function formatPhoneE164(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return null;
}

/**
 * Rounds a number DOWN to 2 decimal places (penny round-down).
 * Standard for all monetary values per finance spec v1.2.
 */
function floorCents(amount) {
  return Math.floor(amount * 100) / 100;
}

module.exports = {
  formatDateYMD,
  formatDateDMY,   // duplicate - see note above
  paginate,
  deepClone,
  formatPhoneE164, // dead code - see note above
  floorCents
};

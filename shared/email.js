// Email checks shared by the browser (instant feedback) and the server (the real gate).

export const MAX_EMAIL_LENGTH = 254

// Practical rather than full RFC 5322: one @, no spaces, a dot in the domain,
// no empty labels or edge dots/hyphens, and a top-level domain of 2+ letters.
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/

// Lowercased so "Mark@Example.com" and "mark@example.com" are the same
// learner in the LRS, which matches agents by their exact mbox.
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

// Returns an error message, or '' when the address is fine.
export function emailError(email) {
  if (!email) return 'Enter your email address.'
  if (email.length > MAX_EMAIL_LENGTH) {
    return `Email address must be ${MAX_EMAIL_LENGTH} characters or fewer.`
  }
  const [local = ''] = email.split('@')
  if (
    !EMAIL_PATTERN.test(email) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  ) {
    return 'Enter an email address in the format name@example.com.'
  }
  return ''
}

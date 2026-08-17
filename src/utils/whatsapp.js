function normalizeWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  let number = digits.startsWith('00') ? digits.slice(2) : digits;

  // Accept the common Pakistani local forms as well as an already complete
  // international number. WhatsApp requires the country code without "+".
  if (number.length === 11 && number.startsWith('0')) {
    number = `92${number.slice(1)}`;
  } else if (number.length === 10 && number.startsWith('3')) {
    number = `92${number}`;
  }

  if (!/^\d{8,15}$/.test(number)) {
    throw new Error('Please save a valid customer WhatsApp number first');
  }

  return number;
}

function buildWhatsAppDesktopUrl(phone, message = '') {
  const number = normalizeWhatsAppNumber(phone);
  return `whatsapp://send?phone=${number}&text=${encodeURIComponent(String(message).trim())}`;
}

module.exports = { normalizeWhatsAppNumber, buildWhatsAppDesktopUrl };

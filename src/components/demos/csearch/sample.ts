// A SAMPLE codebase for the in-page search: six small files, written for this
// page in the style of csearch's own eval fixture (a toy shop). It is not
// Tommy's code and not a real product. Line numbers below are real for these
// files, so every answer is an honest file:start-end.

export interface SampleFile { path: string; lang: 'python' | 'typescript'; text: string }

export const SAMPLE: SampleFile[] = [
  {
    path: 'checkout.py',
    lang: 'python',
    text: `"""Checkout helpers for the sample shop."""

from __future__ import annotations


def checkCheckoutFields(form: dict[str, str]) -> list[str]:
    """Validate the checkout form before an order is created."""

    errors: list[str] = []
    # every field the payment step needs must be present
    for field in ("email", "address", "postcode"):
        if not form.get(field, "").strip():
            errors.append(f"{field} is required")
    # the courier re-checks the postcode, so this check stays loose
    return errors


def validate_cart_items(cart: list[dict[str, object]]) -> list[str]:
    """Return errors for malformed shopping-cart rows."""

    errors: list[str] = []
    for index, row in enumerate(cart):
        if not row.get("sku"):
            errors.append(f"item {index} is missing a sku")
        if int(row.get("quantity", 0)) <= 0:
            errors.append(f"item {index} has invalid quantity")
    return errors


def compute_discount_total(subtotal: float, coupon: str | None) -> float:
    """Apply a promotional discount code to the subtotal."""

    if coupon == "SAVE10":
        return subtotal * 0.90
    if coupon == "HALF":
        return subtotal * 0.50
    return subtotal


def authorize_payment_token(token: str, amount_cents: int) -> bool:
    """Check whether a payment token can be charged."""

    if not token.startswith("tok_"):
        return False
    return amount_cents > 0


def build_receipt_summary(order_id: str, total_cents: int) -> str:
    """Format a short receipt line for the customer."""

    dollars = total_cents / 100
    return f"order {order_id}: \${dollars:.2f}"


def estimate_shipping_quote(weight_grams: int, express: bool = False) -> int:
    """Quote a delivery price in cents from parcel weight."""

    base = 450 + (weight_grams // 500) * 120
    # express doubles the courier's rate
    return base * 2 if express else base
`,
  },
  {
    path: 'config.py',
    lang: 'python',
    text: `"""Configuration helpers for the sample shop."""

from __future__ import annotations

import os


def read_environment_settings(prefix: str) -> dict[str, str]:
    """Collect environment variables that share a prefix."""

    return {
        key[len(prefix) :].lower(): value
        for key, value in os.environ.items()
        if key.startswith(prefix)
    }


def coerce_boolean_flag(value: str | None) -> bool:
    """Turn common string values into a boolean flag."""

    if value is None:
        return False
    return value.strip().casefold() in {"1", "true", "yes", "on"}


def load_database_url(default: str = "sqlite:///local.db") -> str:
    """Read the application database connection string."""

    configured = os.environ.get("DATABASE_URL")
    if configured:
        return configured
    return default


def parse_retry_budget(raw_value: str | None, fallback: int = 3) -> int:
    """Parse a retry-count setting with a safe fallback."""

    if raw_value is None:
        return fallback
    try:
        return max(0, int(raw_value))
    except ValueError:
        return fallback
`,
  },
  {
    path: 'inventory.py',
    lang: 'python',
    text: `"""Inventory operations for the sample shop."""

from __future__ import annotations

from datetime import UTC, datetime


def normalize_sku(raw_sku: str) -> str:
    """Normalize product identifiers before storage."""

    return raw_sku.strip().upper().replace("-", "")


def reserve_stock_for_order(stock: dict[str, int], sku: str, quantity: int) -> bool:
    """Reserve stock units for a pending order."""

    normalized = normalize_sku(sku)
    available = stock.get(normalized, 0)
    if available < quantity:
        return False
    stock[normalized] = available - quantity
    return True


def release_expired_holds(holds: dict[str, datetime], cutoff: datetime) -> list[str]:
    """Release reservation holds older than a cutoff timestamp."""

    expired = [
        hold_id
        for hold_id, created_at in holds.items()
        if created_at.replace(tzinfo=UTC) < cutoff
    ]
    for hold_id in expired:
        holds.pop(hold_id, None)
    return expired


def reorder_low_stock(stock: dict[str, int], threshold: int) -> list[str]:
    """List products that should be reordered soon."""

    return [sku for sku, quantity in stock.items() if quantity <= threshold]
`,
  },
  {
    path: 'auth/session.py',
    lang: 'python',
    text: `"""Login sessions for the sample shop."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta


def create_session(user_id: str, ttl_minutes: int = 60) -> dict[str, object]:
    """Start a login session and return its cookie payload."""

    return {
        "sid": secrets.token_urlsafe(24),
        "user_id": user_id,
        "expires_at": datetime.now(UTC) + timedelta(minutes=ttl_minutes),
    }


def reject_stale_session(session: dict[str, object]) -> bool:
    """Refuse a session whose expiry time has passed."""

    expires_at = session.get("expires_at")
    # a session without an expiry is treated as stale
    if not isinstance(expires_at, datetime):
        return True
    return expires_at <= datetime.now(UTC)


def hash_password(password: str, salt: bytes) -> str:
    """Derive a stored password hash with PBKDF2."""

    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return digest.hex()


def verify_password(password: str, salt: bytes, stored: str) -> bool:
    """Compare a login attempt against the stored hash."""

    return secrets.compare_digest(hash_password(password, salt), stored)
`,
  },
  {
    path: 'web/forms.ts',
    lang: 'typescript',
    text: `// Client-side form helpers for the sample shop.

/** Validate a shipping address form and return messages by field. */
export function validateAddressForm(form: Record<string, string>): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!form.street?.trim()) problems.street = 'Street is required';
  if (!/^\\d{5}$/.test(form.zip ?? '')) problems.zip = 'Use a five-digit ZIP code';
  return problems;
}

/** Format a phone number as the user types. */
export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\\D/g, '').slice(0, 10);
  if (digits.length < 7) return digits;
  return \`(\${digits.slice(0, 3)}) \${digits.slice(3, 6)}-\${digits.slice(6)}\`;
}

/** Wait until the user stops typing before calling fn. */
export function debounce<T extends unknown[]>(fn: (...args: T) => void, waitMs = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/** Keep the submit button disabled while a request is in flight. */
export function lockSubmitButton(button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}
`,
  },
  {
    path: 'notify/email.ts',
    lang: 'typescript',
    text: `// Outgoing email for the sample shop.

/** Send the order confirmation email after payment succeeds. */
export async function sendOrderConfirmation(to: string, orderId: string): Promise<void> {
  const body = renderTemplate('order-confirmed', { orderId });
  await mailer.send({ to, subject: \`Order \${orderId} confirmed\`, body });
}

/** Fill {{placeholders}} in a named email template. */
export function renderTemplate(name: string, values: Record<string, string>): string {
  return templates[name].replace(/{{(\\w+)}}/g, (_, key) => values[key] ?? '');
}

/** Return true when the user has the weekly digest enabled. */
export function shouldSendDigest(user: { digest: boolean; unsubscribed: boolean }): boolean {
  // unsubscribing always wins over the digest setting
  return user.digest && !user.unsubscribed;
}

/** Try a send again with exponential backoff. */
export async function retryWithBackoff<T>(task: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await task();
    } catch (err) {
      if (i + 1 >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 200));
    }
  }
}
`,
  },
];

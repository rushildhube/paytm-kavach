/** "rahul.k92@okaxis" -> "ra***@okaxis". Idempotent on already-masked values. */
export function maskVpa(vpa: string): string {
  const [name, handle] = vpa.split("@");
  if (!handle) return "***";
  if (name.includes("*")) return vpa;
  return `${name.slice(0, 2)}***@${handle}`;
}

/** Keep only the last four digits of an account number. */
export function last4(account: string): string {
  const digits = account.replace(/\D/g, "");
  return digits.slice(-4);
}

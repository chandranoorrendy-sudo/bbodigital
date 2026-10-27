/**
 * Login memakai username dari guru (seperti IXL). Supabase Auth tetap butuh email,
 * jadi username dipetakan ke alamat internal di domain .invalid yang tidak pernah menerima surat.
 */
export const USERNAME_DOMAIN = "bbo-kuttab.invalid";

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

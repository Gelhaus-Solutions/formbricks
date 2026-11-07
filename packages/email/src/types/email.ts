export interface TEmailTemplateLegalProps {
  privacyUrl?: string;
  termsUrl?: string;
  imprintUrl?: string;
  imprintAddress?: string;
  /**
   * The instance's own logo, shown when the organization has none. Absolute, because mail clients
   * load it. Without it the email has no logo rather than one fetched from somebody else's server.
   */
  defaultLogoUrl?: string;
}

import { Body, Column, Container, Head, Html, Img, Link, Row, Section, Tailwind, Text } from "react-email";
import { TEmailTemplateLegalProps } from "../types/email";
import { TFunction } from "../types/translations";

const FORCE_LIGHT_COLOR_SCHEME = "only light";
/**
 * Widths are also emitted as `width` HTML attributes, in px, to match the `w-60` / `w-80` classes.
 * Tailwind compiles those classes to `rem`, and Outlook's Word rendering engine supports neither
 * `rem` nor `max-height` / `object-fit`, so without the attribute it constrains the logo not at
 * all and renders it at its natural size. An image wider than the email body cannot be centered,
 * which is why the width is part of fixing the centering rather than a separate concern.
 */
const DEFAULT_LOGO_WIDTH = 240; // w-60
const CUSTOM_LOGO_WIDTH = 320; // w-80

interface EmailTemplateProps extends TEmailTemplateLegalProps {
  readonly children: React.ReactNode;
  readonly forceLightMode?: boolean;
  readonly logoUrl?: string;
  readonly t: TFunction;
}

export function EmailTemplate({
  children,
  forceLightMode = false,
  logoUrl,
  t,
  privacyUrl,
  imprintUrl,
  imprintAddress,
  defaultLogoUrl,
}: EmailTemplateProps): React.JSX.Element {
  const isDefaultLogo = !logoUrl || logoUrl === defaultLogoUrl;
  const showLogo = !isDefaultLogo || Boolean(defaultLogoUrl);

  return (
    <Html>
      {forceLightMode && (
        <Head>
          <meta name="color-scheme" content="only light" />
          <meta name="supported-color-schemes" content="light" />
          <style>
            {`:root {
  color-scheme: only light;
  supported-color-schemes: light;
}`}
          </style>
        </Head>
      )}
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-sm text-slate-800"
          style={{
            ...(forceLightMode
              ? { backgroundColor: "#f8fafc", color: "#1e293b", colorScheme: FORCE_LIGHT_COLOR_SCHEME }
              : {}),
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          {/* The logo is centered on the wrapping cell, not on the image itself: Outlook's Word
              rendering engine ignores `margin: auto`, so `mx-auto` alone left-aligns the logo
              there. `align="center"` is an HTML attribute Word does honor, and `Column` is the
              only react-email primitive that renders a `<td>` we can put it on (`Section` keeps
              its cell bare). `mx-auto` stays for clients that honor the image's own margins. */}
          {showLogo && (
            <Row>
              <Column align="center" className="text-center">
                {isDefaultLogo ? (
                  <Img
                    data-testid="default-logo-image"
                    alt="Logo"
                    className="mx-auto w-60"
                    src={defaultLogoUrl}
                    width={DEFAULT_LOGO_WIDTH}
                  />
                ) : (
                  <Img
                    data-testid="logo-image"
                    alt="Logo"
                    className="mx-auto max-h-[100px] w-80 object-contain"
                    src={logoUrl}
                    width={CUSTOM_LOGO_WIDTH}
                  />
                )}
              </Column>
            </Row>
          )}
          <Container className="mx-auto my-8 max-w-xl rounded-md bg-white p-4 text-start">
            {children}
          </Container>

          <Section className="mt-4 text-center text-sm">
            <Text className="m-0 text-sm font-normal text-slate-500">
              {t("emails.email_template_text_1")}
            </Text>
            {imprintAddress && (
              <Text className="m-0 text-sm font-normal text-slate-500 opacity-50">{imprintAddress}</Text>
            )}
            <Text className="m-0 text-sm font-normal text-slate-500 opacity-50">
              {imprintUrl && (
                <Link
                  href={imprintUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-500">
                  {t("emails.imprint")}
                </Link>
              )}
              {imprintUrl && privacyUrl && " • "}
              {privacyUrl && (
                <Link
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-500">
                  {t("emails.privacy_policy")}
                </Link>
              )}
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EmailTemplate;

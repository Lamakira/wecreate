import { ThemePreview, themePreviewMetadata } from "../theme-preview";

export const generateMetadata = themePreviewMetadata;

export default function BrandingThemePreviewRoute() {
  return <ThemePreview discipline="branding" />;
}

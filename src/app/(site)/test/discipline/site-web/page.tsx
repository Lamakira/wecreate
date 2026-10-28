import { ThemePreview, themePreviewMetadata } from "../theme-preview";

export const generateMetadata = themePreviewMetadata;

export default function SiteWebThemePreviewRoute() {
  return <ThemePreview discipline="site-web" />;
}

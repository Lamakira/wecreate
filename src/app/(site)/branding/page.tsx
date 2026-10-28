import type { Metadata } from "next";

import { HomePage, homePageMetadata } from "@/components/home/home-page";

export async function generateMetadata(): Promise<Metadata> {
  return homePageMetadata("branding");
}

/** Branding's homepage. */
export default function BrandingHomePageRoute() {
  return <HomePage discipline="branding" />;
}

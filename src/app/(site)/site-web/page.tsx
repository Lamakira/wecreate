import type { Metadata } from "next";

import { HomePage, homePageMetadata } from "@/components/home/home-page";

export async function generateMetadata(): Promise<Metadata> {
  return homePageMetadata("site-web");
}

/** Site web's homepage. */
export default function SiteWebHomePageRoute() {
  return <HomePage discipline="site-web" />;
}

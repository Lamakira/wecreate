import type { Metadata } from "next";

import { HomePage, homePageMetadata } from "@/components/home/home-page";

export async function generateMetadata(): Promise<Metadata> {
  return homePageMetadata("videographie");
}

/** The homepage, which is Vidéographie's. */
export default function HomePageRoute() {
  return <HomePage discipline="videographie" />;
}

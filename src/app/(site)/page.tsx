import type { Metadata } from "next";

import { HomePage } from "@/components/home/home-page";
import { readHome } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readHome();
  const { seo } = content.homePage;

  return {
    // No template: the homepage's title is the brand's own, and Next.js would
    // not apply a same-segment template to it either.
    ...pageMetadata(
      content.settings.seo,
      {
        title: seo.title,
        description: seo.description,
        imageUrl: seo.openGraphImageUrl,
      },
      { template: false },
    ),
    alternates: { canonical: "/" },
  };
}

/** The homepage, which is Vidéographie's. */
export default function HomePageRoute() {
  return <HomePage discipline="videographie" />;
}

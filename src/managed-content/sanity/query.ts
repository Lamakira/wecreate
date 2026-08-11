import { defineQuery } from "next-sanity";

const CALL_TO_ACTION = "{label, href}";
const SPLIT_HEADLINE = "{lead, emphasis, trail}";
const MEDIA_FRAME =
  '{ratio, placeholderLabel, alternativeText, "imageUrl": image.asset->url}';

/**
 * Both singletons in one round trip.
 *
 * Fields absent from the dataset come back as `null` and are filled in from
 * `DEFAULT_SITE_CONTENT`, so a freshly created Sanity project renders the site
 * rather than a blank page.
 */
export const SITE_CONTENT_QUERY = defineQuery(`{
  "settings": *[_type == "siteSettings"][0]{
    brandName,
    positioningLine,
    navigation[]{label, href},
    headerCta${CALL_TO_ACTION},
    contact{whatsappLabel, whatsappUrl, email, locationLabel},
    socialAccounts[]{label, url},
    footer{baseline, navigationHeading, contactHeading, socialHeading, legalLine},
    seo{
      siteName,
      titleTemplate,
      defaultTitle,
      defaultDescription,
      openGraphLocale,
      "openGraphImageUrl": openGraphImage.asset->url
    }
  },
  "homePage": *[_type == "homePage"][0]{
    seo{title, description, "openGraphImageUrl": openGraphImage.asset->url},
    hero{
      kicker,
      headline${SPLIT_HEADLINE},
      subtitle,
      primaryCta${CALL_TO_ACTION},
      secondaryCta${CALL_TO_ACTION}
    },
    positioningMarquee{isVisible, text},
    universes{
      isVisible,
      title,
      kicker,
      universes[]{
        "key": coalesce(key.current, _key),
        kicker,
        title,
        description,
        linkLabel,
        href,
        media${MEDIA_FRAME}
      }
    },
    recentWork{isVisible, headline${SPLIT_HEADLINE}, link${CALL_TO_ACTION}, emptyStateText},
    proof{
      isVisible,
      kicker,
      points[]{"key": _key, figure, description}
    },
    shopPreview{isVisible, title, link${CALL_TO_ACTION}, linkLabel, emptyStateText},
    brandQuote{isVisible, quote, attribution},
    finalCta{
      isVisible,
      headline${SPLIT_HEADLINE},
      subtitle,
      primaryCta${CALL_TO_ACTION},
      secondaryCta${CALL_TO_ACTION}
    }
  }
}`);

import { defineQuery } from "next-sanity";

const CALL_TO_ACTION = "{label, href}";
const SPLIT_HEADLINE = "{lead, emphasis, trail}";
const MEDIA_FRAME =
  '{ratio, placeholderLabel, alternativeText, "imageUrl": image.asset->url}';

/**
 * A poster asked for at the size the page uses it.
 *
 * Sanity's asset CDN resizes and reformats from the URL, so the image arrives
 * ready and the application never puts a second optimiser in front of it.
 */
const POSTER_FRAME =
  '{ratio, placeholderLabel, alternativeText, "imageUrl": image.asset->url + "?w=1600&auto=format"}';

/**
 * The video association, in the application's vocabulary rather than Mux's.
 *
 * Only what the CMS legitimately knows crosses this line: whether the upload
 * has finished, its identity, and which caption tracks exist. Turning any of
 * that into an address is the playback provider's job (ADR-0008).
 */
const PLAYBACK_ASSOCIATION = `{
  "playbackId": playbackId,
  "isReady": status == "ready",
  "textTracks": data.tracks[type == "text" && text_type == "subtitles"]{
    "id": id,
    "language": language_code,
    "label": coalesce(name, language_code)
  }
}`;

/**
 * Everything the public site reads, in one round trip.
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
    contact{
      whatsappLabel,
      whatsappUrl,
      discoveryCallLabel,
      discoveryCallUrl,
      email,
      locationLabel
    },
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
  },
  "servicesPage": *[_type == "servicesPage"][0]{
    seo{title, description, "openGraphImageUrl": openGraphImage.asset->url},
    kicker,
    headline${SPLIT_HEADLINE},
    methodColumns,
    onRequestLabel,
    enquiry{
      title,
      notice,
      whatsappLabel,
      whatsappMessageTemplate,
      discoveryCallLabel,
      discoveryCallNote
    },
    universes[]{
      "key": coalesce(key.current, _key),
      kicker,
      title,
      intro,
      packs[]{
        "id": coalesce(id.current, _key),
        name,
        priceXof,
        priceUnit,
        isOnRequest,
        audience,
        commitment,
        paymentTerms,
        inclusions
      }
    },
    comparison{
      isVisible,
      kicker,
      title,
      caption,
      columns,
      rows[]{"key": coalesce(key.current, _key), label, values}
    },
    addOns{
      isVisible,
      kicker,
      title,
      addOns[]{
        "key": coalesce(key.current, _key),
        title,
        priceXof,
        priceUnit,
        description
      }
    }
  },
  "aboutPage": *[_type == "aboutPage"][0]{
    seo{title, description, "openGraphImageUrl": openGraphImage.asset->url},
    kicker,
    headline${SPLIT_HEADLINE},
    story{
      paragraphs,
      brandStatement,
      portrait${POSTER_FRAME}
    },
    method{
      isVisible,
      kicker,
      title,
      steps[]{"key": coalesce(key.current, _key), title, description}
    },
    team{
      kicker,
      items[]{"key": coalesce(key.current, _key), title, description}
    },
    equipment{
      kicker,
      items[]{"key": coalesce(key.current, _key), title, description}
    },
    coverage{kicker, text, link${CALL_TO_ACTION}}
  },
  "contactPage": *[_type == "contactPage"][0]{
    seo{title, description, "openGraphImageUrl": openGraphImage.asset->url},
    kicker,
    headline${SPLIT_HEADLINE},
    responseExpectation,
    channels{
      kicker,
      notice,
      whatsappNote,
      discoveryCallNote,
      emailLabel,
      emailNote,
      socialKicker,
      locationNote
    },
    gettingStarted{
      kicker,
      steps[]{"key": coalesce(key.current, _key), title, description}
    }
  },
  "portfolioPage": *[_type == "portfolioPage"][0]{
    seo{title, description, "openGraphImageUrl": openGraphImage.asset->url},
    kicker,
    headline${SPLIT_HEADLINE},
    allUniversesLabel,
    emptyStateText
  },
  "portfolioProjects": *[_type == "portfolioProject"]
    | order(coalesce(publishedAt, _createdAt) desc){
      "id": _id,
      "slug": slug.current,
      title,
      client,
      universe,
      projectType,
      description,
      role,
      deliverables,
      media${POSTER_FRAME},
      "video": video.asset->${PLAYBACK_ASSOCIATION},
      hasPublicationPermission,
      spokenContent,
      transcript
    }
}`);

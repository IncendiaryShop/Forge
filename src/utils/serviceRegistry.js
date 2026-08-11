import {
  siYoutube, siNetflix, siSpotify, siApple, siGoogle,
  siGithub, siDropbox, siNotion, siZoom,
} from "simple-icons";

/* -------------------------------------------------------------------------
   Centralized recurring-payment service registry.
   Each entry maps a stable provider id -> display name -> official brand
   icon (from the `simple-icons` package: bundled, offline, legitimate
   brand assets — https://simpleicons.org).

   A handful of requested brands (Amazon, Microsoft, Adobe, ChatGPT/OpenAI,
   Canva, Slack, Disney+, Prime Video) are not distributed by simple-icons
   because their trademark holders have not granted redistribution
   permission for that library. Rather than fabricate an approximation of
   those marks, `icon` is left null for them and the UI falls back to the
   generic recurring-payment icon — the same fallback used for "custom"
   services and for bills with no provider set.

   Adding a newly-supported brand later is a single entry here.
------------------------------------------------------------------------- */

export const SERVICES = [
  { id: "youtube", name: "YouTube / YouTube Premium", icon: siYoutube },
  { id: "netflix", name: "Netflix", icon: siNetflix },
  { id: "spotify", name: "Spotify", icon: siSpotify },
  { id: "amazon", name: "Amazon / Amazon Prime", icon: null },
  { id: "apple", name: "Apple", icon: siApple },
  { id: "google", name: "Google / Google One", icon: siGoogle },
  { id: "microsoft", name: "Microsoft / Microsoft 365", icon: null },
  { id: "adobe", name: "Adobe", icon: null },
  { id: "openai", name: "ChatGPT / OpenAI", icon: null },
  { id: "dropbox", name: "Dropbox", icon: siDropbox },
  { id: "canva", name: "Canva", icon: null },
  { id: "github", name: "GitHub", icon: siGithub },
  { id: "notion", name: "Notion", icon: siNotion },
  { id: "slack", name: "Slack", icon: null },
  { id: "zoom", name: "Zoom", icon: siZoom },
  { id: "disneyplus", name: "Disney+", icon: null },
  { id: "primevideo", name: "Prime Video", icon: null },
  { id: "custom", name: "Other / Custom", icon: null },
];

const CUSTOM_SERVICE = SERVICES[SERVICES.length - 1];

export function getService(providerId) {
  return SERVICES.find(s => s.id === providerId) || CUSTOM_SERVICE;
}

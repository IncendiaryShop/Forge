import {
  siYoutube, siNetflix, siSpotify, siApple, siGoogle,
  siGithub, siDropbox, siNotion, siZoom,
} from "simple-icons";

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

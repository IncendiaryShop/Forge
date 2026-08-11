// Shared helper for every service module. Supabase errors carry technical
// detail (constraint names, internal codes) that shouldn't reach end users of
// a financial app — this maps them to a short, safe message, while logging
// the raw error to the console in development only (section 10 of the
// migration brief).

const FRIENDLY = {
  23505: "That already exists.",
  23503: "This record is linked to other data and can't be changed that way.",
  23514: "That value isn't valid.",
  42501: "You don't have permission to do that.",
};

export function toUserMessage(error, fallback) {
  if (!error) return null;
  if (error.message === "Failed to fetch") {
    return "Network error — check your connection and try again.";
  }
  return FRIENDLY[error.code] || fallback || "Something went wrong. Please try again.";
}

// Wraps a Supabase call, logging the raw error in dev and always returning
// { data, error } — error is either null or { message, raw } where `message`
// is safe to show in the UI. Never throws.
export async function call(promise, fallbackMessage) {
  try {
    const { data, error } = await promise;
    if (error) {
      if (import.meta.env.DEV) console.error(error);
      return { data: null, error: { message: toUserMessage(error, fallbackMessage), raw: error } };
    }
    return { data, error: null };
  } catch (err) {
    if (import.meta.env.DEV) console.error(err);
    return { data: null, error: { message: toUserMessage(err, fallbackMessage), raw: err } };
  }
}

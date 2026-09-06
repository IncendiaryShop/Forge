

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

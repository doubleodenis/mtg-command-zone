// Scryfall API integration
// Rate limit: 10 requests/second - implement 100ms delay between requests

const SCRYFALL_BASE_URL = "https://api.scryfall.com";

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": "MTGCommanderTracker/1.0",
      Accept: "application/json",
    },
  });
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  type_line: string;
  mana_cost?: string;
  colors?: string[];
  color_identity: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
    border_crop: string;
  };
  card_faces?: Array<{
    name: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      art_crop: string;
      border_crop: string;
    };
  }>;
}

export interface ScryfallSearchResult {
  object: string;
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}

export interface ScryfallAutocomplete {
  object: string;
  total_values: number;
  data: string[];
}

/**
 * Get image URI from a Scryfall card, handling multi-face cards
 */
export function getCardImageUri(
  card: ScryfallCard,
  size: "small" | "normal" | "large" | "art_crop" = "normal"
): string {
  // Check top-level image_uris first
  if (card.image_uris) {
    return card.image_uris[size];
  }

  // For multi-face cards, use the first face
  if (card.card_faces && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris[size];
  }

  // Fallback placeholder
  return "/card-placeholder.png";
}

/**
 * Search for commander-legal cards
 */
export async function searchCommanders(
  query: string
): Promise<ScryfallCard[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    // Search for legendary creatures that are legal commanders
    const searchQuery = encodeURIComponent(`is:commander ${query}`);
    const response = await rateLimitedFetch(
      `${SCRYFALL_BASE_URL}/cards/search?q=${searchQuery}&order=edhrec`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No results found
      }
      throw new Error(`Scryfall API error: ${response.status}`);
    }

    const data: ScryfallSearchResult = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching commanders:", error);
    return [];
  }
}

/**
 * Autocomplete card names (fast, lightweight)
 */
export async function autocompleteCard(query: string): Promise<string[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const response = await rateLimitedFetch(
      `${SCRYFALL_BASE_URL}/cards/autocomplete?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      return [];
    }

    const data: ScryfallAutocomplete = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error autocompleting card:", error);
    return [];
  }
}

/**
 * Get a card by its Scryfall ID
 */
export async function getCardById(
  scryfallId: string
): Promise<ScryfallCard | null> {
  try {
    const response = await rateLimitedFetch(
      `${SCRYFALL_BASE_URL}/cards/${scryfallId}`
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching card:", error);
    return null;
  }
}

/**
 * Get a card by exact name
 */
export async function getCardByName(
  name: string
): Promise<ScryfallCard | null> {
  try {
    const response = await rateLimitedFetch(
      `${SCRYFALL_BASE_URL}/cards/named?exact=${encodeURIComponent(name)}`
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching card by name:", error);
    return null;
  }
}

/**
 * Get random commander (for fun/testing)
 */
export async function getRandomCommander(): Promise<ScryfallCard | null> {
  try {
    const response = await rateLimitedFetch(
      `${SCRYFALL_BASE_URL}/cards/random?q=is:commander`
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching random commander:", error);
    return null;
  }
}

/**
 * Get commander image URL directly by card name
 * Returns the image URL or null if not found
 */
export async function getCommanderImageUrl(
  commanderName: string,
  size: "small" | "normal" | "large" | "art_crop" = "normal"
): Promise<string | null> {
  const card = await getCardByName(commanderName);
  if (!card) return null;
  return getCardImageUri(card, size);
}

/**
 * Build Scryfall image URL without an API call
 * Uses Scryfall's static image endpoint with the card's exact name
 * This is useful for displaying images when you only have the card name
 * Format: https://api.scryfall.com/cards/named?exact={name}&format=image&version={size}
 */
export function buildCommanderImageUrl(
  commanderName: string,
  size: "small" | "normal" | "large" | "art_crop" | "border_crop" = "normal"
): string {
  return `${SCRYFALL_BASE_URL}/cards/named?exact=${encodeURIComponent(commanderName)}&format=image&version=${size}`;
}

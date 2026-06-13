import { GoogleGenAI } from "@google/genai";
import { WeatherData, WEATHER_CODES, MusicGenre, SearchedSongMetadata, LLMConfig } from '../types';

// Default model (can be overridden via config)
const DEFAULT_MODEL_TEXT = "gemini-3.1-flash";

// Fallback safety-net track: verified NCS embeddable ID.
const FALLBACK_VIDEO_ID = 'K4DyBUG242c';

export interface MusicalPromptResult {
  searchedSong: SearchedSongMetadata;
  musicalPrompt: string;
  lyrics: string;
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const isValidVideoId = (id: string | undefined): id is string => {
  return typeof id === 'string' && YOUTUBE_ID_REGEX.test(id.trim());
};

const buildSystemInstruction = (blacklist?: string) => `
  You are AetherClock's AI Music Curator.
  Your mission is to search for a highly suitable real-world song (including title and artist) matching the user's current context (time, weather, active appointment, theme).
  
  ${blacklist ? `CRITICAL BLOCKLIST FILTER: You must NOT under any circumstances return songs, artists, or titles containing, matching, or related to the following blacklisted terms/artists: "${blacklist}". Suggest an alternative artist if their songs match. This is a strict user filter constraint.` : ""}

  CRITICAL INSTRUCTIONS:
  1. First, search for a suitable real-world song using your Google Search capability based on:
     - The next or active calendar appointment (e.g. scan the agenda for items around this time).
     - If no prominent calendar event fits, search based on the alarm/current time (e.g. search for popular songs with themes matching that time, or dawn/dusk/midday vibes).
     - Consider the weather and selected music theme/genre preset (e.g., Rock, Classical, Chill/LoFi, Synthwave, Acoustic, or Auto-Tune / Custom Search).
  2. Once a matched song is found, write a personalized radio performance prompt.
  3. Customize the original lyrics of that song (or write a fresh custom adaptation) to incorporate the user's specific context (like mentioning their specific active agenda item, current outdoor temperature/weather, and alarm time).
  
  CRITICAL YOUTUBE RULES:
  - You MUST return a youtubeVideoId for the song you selected. This field is REQUIRED, not optional.
  - The youtubeVideoId MUST be exactly 11 characters long and contain only letters, numbers, underscores, or hyphens (e.g., "dQw4w9WgXcQ").
  - Search for the best embeddable version: prefer lyric videos, audio uploads, live sessions, or creative-commons covers.
  - If no alternative version exists, the official music video or artist channel upload is acceptable — most allow embedding.
  - Only return the exact 11-character ID, never a full URL, never a playlist ID, never a search query.
  - NEVER omit the youtubeVideoId field. Before you respond, verify that the ID is 11 characters and looks like a real YouTube video ID. If you cannot find a specific ID, return the most popular upload's ID for that song.
  
  You MUST respond with a valid, clean, parseable JSON object matching this schema:
  {
    "searchedSong": {
      "title": "Name of the real song you found",
      "artist": "Name of the artist of that song",
      "youtubeVideoId": "The exact 11-character YouTube video ID (REQUIRED)",
      "whyExplanation": "Clear explanation of how the song matches the time of day, active appointment, or theme preset",
      "foundTheme": "One-word theme keyword (e.g., Morning, Energetic, Cozy, Productive, Relax)",
      "styleDescription": "Detailed musical style, speed, and instrumentation matching the selected genre preset"
    },
    "musicalPrompt": "A single dense sentence describing style, genre, speed, mood, and instruments, to feed into a music model",
    "lyrics": "4-8 lines of rhyming lyrics in the style of the song, adapted to mention the alarm time and active appointment details"
  }
`;

const buildUserPrompt = (
  weather: WeatherData | null,
  location: string | null,
  agenda: string,
  localTime: Date,
  alarmTime: string,
  genrePreset: MusicGenre
) => {
  const weatherDesc = weather
    ? `${weather.temperature}°C with ${WEATHER_CODES[weather.conditionCode] || 'clear skies'}`
    : "mild weather";

  const dateStr = localTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = localTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `
    Find a suitable song and generate lyrics.
    
    Context:
    - Current local date and time: ${dateStr}, ${timeStr}
    - Alarm wake-up time: ${alarmTime}
    - Selected Theme Preset: ${genrePreset}
    - Weather condition: ${weatherDesc}
    - Location: ${location || "Unknown"}
    
    User's Agenda/Schedule:
    ${agenda || "No appointments."}
    
    Search target:
    - If there is an appointment within +/- 2 hours of the alarm/current time, search specifically for a real song that fits that appointment's activity (e.g., workout song, meeting/work song, study/learning song).
    - If there is no near appointment, search for a real song that has a title, lyrics, or strong thematic presence matching the time "${alarmTime || timeStr}". For example, morning anthems, coffee shop tracks, afternoon beats, or sunset chill tracks.
    
    Generate the JSON response containing details of the found song, the musical prompt, and customized lyrics.
  `;
};

const parseResult = (bodyText: string, genrePreset: MusicGenre, alarmTime: string, weatherDesc: string): MusicalPromptResult | null => {
  try {
    const cleanedText = bodyText.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const result: MusicalPromptResult = JSON.parse(cleanedText);
    return result;
  } catch (parseError) {
    console.warn("Failed to parse JSON from response, attempting regex fallback...", bodyText);

    const titleMatch = bodyText.match(/"title"\s*:\s*"([^"]+)"/);
    const artistMatch = bodyText.match(/"artist"\s*:\s*"([^"]+)"/);
    const ytMatch = bodyText.match(/"youtubeVideoId"\s*:\s*"([^"]+)"/);
    const whyMatch = bodyText.match(/"whyExplanation"\s*:\s*"([^"]+)"/);
    const promptMatch = bodyText.match(/"musicalPrompt"\s*:\s*"([^"]+)"/);
    const lyricsMatch = bodyText.match(/"lyrics"\s*:\s*"([^"]+)"/);

    return {
      searchedSong: {
        title: titleMatch ? titleMatch[1] : `Morning Rise`,
        artist: artistMatch ? artistMatch[1] : "The Radiance",
        youtubeVideoId: ytMatch ? ytMatch[1] : FALLBACK_VIDEO_ID,
        whyExplanation: whyMatch ? whyMatch[1] : "Tuned to a cheerful, bright and motivating theme to welcome the day.",
        foundTheme: "Wake Up",
        styleDescription: `Genre preset: ${genrePreset}`
      },
      musicalPrompt: promptMatch ? promptMatch[1] : `A bright and motivating song, genre ${genrePreset}, with acoustic guitar and light drums.`,
      lyrics: lyricsMatch ? lyricsMatch[1] : `Good morning! The clock strikes ${alarmTime},\nTime to rise up and begin your climb.\n${weatherDesc} is outside your door,\nA beautiful day lies in store.`
    };
  }
};

/**
 * Search for an appropriate real track using Google Search grounding based on
 * current context (weather, locations, appointments, time), then generate an alarm prompt.
 */
export const generateMusicalPrompt = async (
  weather: WeatherData | null,
  location: string | null,
  agenda: string,
  localTime: Date,
  alarmTime: string,
  genrePreset: MusicGenre,
  blacklist?: string,
  config?: LLMConfig
): Promise<MusicalPromptResult> => {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aetherclock-client',
      }
    }
  });

  const weatherDesc = weather
    ? `${weather.temperature}°C with ${WEATHER_CODES[weather.conditionCode] || 'clear skies'}`
    : "mild weather";

  const model = config?.textModel || DEFAULT_MODEL_TEXT;
  const systemInstruction = buildSystemInstruction(blacklist);
  const userPrompt = buildUserPrompt(weather, location, agenda, localTime, alarmTime, genrePreset);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: userPrompt }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      }
    });

    const bodyText = response.text || "";
    const result = parseResult(bodyText, genrePreset, alarmTime, weatherDesc);
    if (!result) {
      throw new Error("Could not parse AI response");
    }

    // If the AI returned everything except a valid video ID, try one focused retry.
    if (!isValidVideoId(result.searchedSong.youtubeVideoId)) {
      console.warn('[generateMusicalPrompt] Missing or invalid youtubeVideoId, retrying...');
      const retryPrompt = `
        You previously selected the song "${result.searchedSong.title}" by "${result.searchedSong.artist}".
        Your only task now is to return the exact 11-character YouTube video ID for the best embeddable upload of that song.
        Respond with ONLY a valid JSON object: {"youtubeVideoId": "XXXXXXXXXXX"}.
      `;

      try {
        const retryResponse = await ai.models.generateContent({
          model,
          contents: { parts: [{ text: retryPrompt }] },
          config: {
            systemInstruction: 'Return only JSON with a valid 11-character YouTube video ID.',
            responseMimeType: "application/json",
            tools: [{ googleSearch: {} }],
          }
        });

        const retryText = retryResponse.text || "";
        const retryMatch = retryText.match(/"youtubeVideoId"\s*:\s*"([^"]+)"/);
        const retryId = retryMatch ? retryMatch[1] : undefined;

        if (isValidVideoId(retryId)) {
          result.searchedSong.youtubeVideoId = retryId;
        }
      } catch (retryError) {
        console.warn('[generateMusicalPrompt] Retry failed:', retryError);
      }
    }

    return result;
  } catch (error) {
    console.error("Context selection failed:", error);
    return {
      searchedSong: {
        title: "On & On",
        artist: "Cartoon feat. Daniel Levi",
        youtubeVideoId: FALLBACK_VIDEO_ID,
        whyExplanation: "AetherClock safety-net track to lift spirits regardless of weather.",
        foundTheme: "Inspirational",
        styleDescription: "Energetic electronic pop with positive vocal delivery"
      },
      musicalPrompt: "An energetic electronic pop song with bright synths, driving beat, and positive vocals.",
      lyrics: "When I wake up in the morning, Lord\nAnd the sunlight hurts my eyes\nAnd something without warning, Lord\nBears heavy on my mind\nThen I look at you, and the world's alright with me."
    };
  }
};

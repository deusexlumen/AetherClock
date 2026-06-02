import { GoogleGenAI, Modality } from "@google/genai";
import { WeatherData, WEATHER_CODES, MusicGenre, SearchedSongMetadata, LLMConfig } from '../types';

// Default models (can be overridden via config)
const DEFAULT_MODEL_TEXT = "gemini-3.5-flash";
const DEFAULT_MODEL_TTS = "gemini-3.1-flash-tts-preview";
const MODEL_ID_FULL = "lyria-3-pro-preview"; // Full song (public preview name)

export interface SongResult {
  audioBase64: string;
  lyrics: string;
  mimeType: string;
}

export interface MusicalPromptResult {
  searchedSong: SearchedSongMetadata;
  musicalPrompt: string;
  lyrics: string;
}

/**
 * Step 1: Search for an appropriate real track using Google Search grounding based on
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
        'User-Agent': 'lyria-radio-client',
      }
    }
  });
  
  const weatherDesc = weather 
    ? `${weather.temperature}°C with ${WEATHER_CODES[weather.conditionCode] || 'clear skies'}`
    : "mild weather";

  const dateStr = localTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = localTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const systemInstruction = `
    You are Lyria Radio's AI Music Curator and Lyricist.
    Your mission is to search for a highly suitable real-world song (including title and artist) matching the user's current context (time, weather, active appointment, theme), and compile it into a customized alarm performance prompt.
    
    ${blacklist ? `CRITICAL BLOCKLIST FILTER: You must NOT under any circumstances return songs, artists, or titles containing, matching, or related to the following blacklisted terms/artists: "${blacklist}". Suggest an alternative artist if their songs match. This is a strict user filter constraint.` : ""}

    CRITICAL INSTRUCTIONS:
    1. First, search for a suitable real-world song using your Google Search capability based on:
       - The next or active calendar appointment (e.g. scan the agenda for items around this time).
       - If no prominent calendar event fits, search based on the alarm/current time (e.g. search for popular songs with themes matching that time, or dawn/dusk/midday vibes).
       - Consider the weather and selected music theme/genre preset (e.g., Rock, Classical, Chill/LoFi, Synthwave, Acoustic, or Auto-Tune / Custom Search).
    2. Once a matched song is found, write a personalized radio performance prompt.
    3. Customize the original lyrics of that song (or write a fresh custom adaptation) to incorporate the user's specific context (like mentioning their specific active agenda item, current outdoor temperature/weather, and alarm time).
    
    You MUST respond with a valid, clean, parseable JSON object matching this schema:
    {
      "searchedSong": {
        "title": "Name of the real song you found",
        "artist": "Name of the artist of that song",
        "youtubeVideoId": "The exact 11-character YouTube video ID for this song. IMPORTANT: You MUST search YouTube specifically for high-quality, embeddable versions such as 'lyrics', 'clean audio', 'live acoustic', or 'creative commons cover' versions. Standard official VEVO/Label music videos are STRICTLY forbidden as they block third-party iframe playback with 'Video unavailable'. Only return the 11-character ID, not the full URL.",
        "whyExplanation": "Clear explanation of how the song matches the time of day, active appointment, or theme preset",
        "foundTheme": "One-word theme keyword (e.g., Morning, Energetic, Cozy, Productive, Relax)",
        "styleDescription": "Detailed musical style, speed, and instrumentation matching the selected genre preset"
      },
      "musicalPrompt": "A single dense sentence describing style, genre, speed, mood, and instruments, to feed into a music model",
      "lyrics": "4-8 lines of rhyming lyrics in the style of the song, adapted to mention the alarm time and active appointment details"
    }
  `;

  const userPrompt = `
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

  try {
    const response = await ai.models.generateContent({
      model: config?.textModel || DEFAULT_MODEL_TEXT,
      contents: { parts: [{ text: userPrompt }] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      }
    });

    const bodyText = response.text || "";
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
          youtubeVideoId: ytMatch ? ytMatch[1] : undefined,
          whyExplanation: whyMatch ? whyMatch[1] : "Tuned to a cheerful, bright and motivating theme to welcome the day.",
          foundTheme: "Wake Up",
          styleDescription: `Genre preset: ${genrePreset}`
        },
        musicalPrompt: promptMatch ? promptMatch[1] : `A bright and motivating song, genre ${genrePreset}, with acoustic guitar and light drums.`,
        lyrics: lyricsMatch ? lyricsMatch[1] : `Good morning! The clock strikes ${alarmTime},\nTime to rise up and begin your climb.\n${weatherDesc} is outside your door,\nA beautiful day lies in store.`
      };
    }
  } catch (error) {
    console.error("Context selection failed:", error);
    return {
      searchedSong: {
        title: "Lovely Day",
        artist: "Bill Withers",
        whyExplanation: "A classic positive morning anthem to lift spirits regardless of weather.",
        foundTheme: "Inspirational",
        styleDescription: "Acoustic soul with rich horns and positive vocal delivery"
      },
      musicalPrompt: "A happy soul-inspired acoustic song with brass elements and high rhythm.",
      lyrics: "When I wake up in the morning, Lord\nAnd the sunlight hurts my eyes\nAnd something without warning, Lord\nBears heavy on my mind\nThen I look at you, and the world's alright with me."
    };
  }
};

/**
 * Step 2: Generate the actual music using the streaming Lyria model.
 */
export const generateSong = async (prompt: string, onProgress?: (msg: string) => void): Promise<SongResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  const keyPreview = apiKey 
    ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} chars)` 
    : "⚠️ MISSING / UNDEFINED";
  
  console.log(`[GenAI] ── Song Generation Start ──`);
  console.log(`[GenAI] API Key: ${keyPreview}`);
  console.log(`[GenAI] Primary Model: ${MODEL_ID_FULL}`);
  console.log(`[GenAI] Fallback Model: ${DEFAULT_MODEL_TTS}`);
  console.log(`[GenAI] Prompt (first 200 chars): ${prompt.substring(0, 200)}`);

  if (onProgress) onProgress("Initializing Lyria model session...");
  
  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;
  let attempt = 0;

  // Attempt 1: Try the specialized Music Model (Lyria 3 Pro)
  while (attempt < MAX_RETRIES) {
    try {
      console.log(`[GenAI] Attempt ${attempt + 1}/${MAX_RETRIES} — calling ${MODEL_ID_FULL}...`);
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'lyria-radio-client',
          }
        }
      });
      const promptText = `Generate a full-length track. \nContext: "${prompt}". \nGenerate lyrics with precise [seconds:] timing markers.`;

      const responseStream = await ai.models.generateContentStream({
        model: MODEL_ID_FULL,
        contents: promptText,
        config: {
          responseModalities: [Modality.AUDIO],
        },
      });

      let audioAccumulator = "";
      let textAccumulator = "";
      let mimeType = "audio/wav";
      let chunkCount = 0;

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioAccumulator && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
              console.log(`[GenAI] Audio MIME type detected: ${mimeType}`);
            }
            audioAccumulator += part.inlineData.data;
            chunkCount++;
            if (onProgress && chunkCount % 10 === 0) {
              onProgress(`Receiving audio stream... (${chunkCount} chunks)`);
            }
          }
          if (part.text) {
            textAccumulator += part.text;
          }
        }
      }
      
      if (!audioAccumulator) throw new Error("No audio data received from stream");

      const audioSizeMB = (audioAccumulator.length * 0.75 / 1024 / 1024).toFixed(1);
      console.log(`[GenAI] ✅ Success! Audio: ${audioSizeMB} MB (${mimeType}), ${chunkCount} chunks`);
      if (onProgress) onProgress("Finalizing audio...");

      return { audioBase64: audioAccumulator, lyrics: textAccumulator || prompt, mimeType };

    } catch (error: any) {
      attempt++;
      const rawMessage = error?.message || error?.toString() || "Unknown error";
      console.error(`[GenAI] ❌ Attempt ${attempt}/${MAX_RETRIES} FAILED:`, rawMessage);

      const isPermission = rawMessage.includes("403") || rawMessage.includes("PERMISSION_DENIED");
      if (isPermission) {
        console.error(`[GenAI] 🔒 PERMISSION_DENIED for model "${MODEL_ID_FULL}".`);
        break; // No point retrying permission errors
      }

      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY * Math.pow(2, attempt - 1); 
        const msg = `Model busy, retrying in ${delayMs / 1000}s (Attempt ${attempt}/${MAX_RETRIES})...`;
        console.warn(`[GenAI] ⏳ ${msg}`);
        if (onProgress) onProgress(msg);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      break;
    }
  }

  // Attempt 2: Fallback to TTS (Gemini 3.1 Flash TTS is extremely natural)
  console.log(`[GenAI] ── Fallback: trying ${DEFAULT_MODEL_TTS} ──`);
  if (onProgress) onProgress("Engaging backup vocal synthesis...");
  
  try {
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'lyria-radio-client',
        }
      }
    });

    const ttsResponse = await ai.models.generateContent({
      model: DEFAULT_MODEL_TTS,
      contents: [{ 
        parts: [{ 
          text: `Say: Here is your personalized daily update song. ${prompt}` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Kore or Fenrir works well
          },
        },
      },
    });

    const ttsPart = ttsResponse.candidates?.[0]?.content?.parts?.[0];
    const ttsData = ttsPart?.inlineData?.data;
    const ttsMimeType = ttsPart?.inlineData?.mimeType || "audio/wav";

    if (ttsData) {
      console.log(`[GenAI] ✅ TTS fallback succeeded`);
      return { audioBase64: ttsData, lyrics: "", mimeType: ttsMimeType };
    }
    throw new Error("Backup TTS generation returned no audio data");
  } catch (ttsError: any) {
    console.error(`[GenAI] ❌ TTS Fallback failed:`, ttsError);
    throw ttsError;
  }
};

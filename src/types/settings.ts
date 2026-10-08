export type ThemeMode = "claro" | "sepia" | "oscuro";
export type ReadingMode = "paginated" | "scroll";

export interface UserSettings {
  theme: ThemeMode;
  fontSize: number;
  readingMode: ReadingMode;
  ttsRate: number;
  ttsPitch: number;
  ttsVoiceURI: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "claro",
  fontSize: 18,
  readingMode: "paginated",
  ttsRate: 1,
  ttsPitch: 1,
  ttsVoiceURI: null,
};

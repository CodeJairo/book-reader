export type ThemeMode = "claro" | "sepia" | "oscuro";
export type ReadingMode = "paginated" | "scroll";
export type ColumnMode = 1 | 2;

export interface UserSettings {
  theme: ThemeMode;
  fontSize: number;
  readingMode: ReadingMode;
  columns: ColumnMode;
  ttsRate: number;
  ttsPitch: number;
  ttsVoiceURI: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "claro",
  fontSize: 18,
  readingMode: "paginated",
  columns: 1,
  ttsRate: 1,
  ttsPitch: 1,
  ttsVoiceURI: null,
};

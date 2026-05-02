export interface UserSettings {
  uiLanguage: "ja" | "en";
  autoTranslateTo?: "ja" | "en";
  playbackRate: number;
}

export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
  settings: UserSettings;
  createdAt: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  uiLanguage: "ja",
  autoTranslateTo: "ja",
  playbackRate: 1.0,
};

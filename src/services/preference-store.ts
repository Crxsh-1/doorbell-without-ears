import type { Preferences } from "./types.js";

export const defaultPreferences: Preferences = {
  deliveryInstruction: "Please leave it by the planter.",
  unknownVisitorInstruction: "Please wait, I'll be there shortly.",
  textSize: "large",
  highContrast: true,
  flashAlerts: false,
  retainTranscripts: false
};

export class PreferenceStore {
  private value: Preferences = { ...defaultPreferences };

  get(): Preferences {
    return { ...this.value };
  }

  update<K extends keyof Preferences>(key: K, value: Preferences[K]): Preferences {
    this.value = { ...this.value, [key]: value };
    return this.get();
  }
}

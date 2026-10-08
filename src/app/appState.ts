export type ActiveView = "library" | "reader" | "store";

export interface AppStateData {
  currentView: ActiveView;
  currentBookId: string | null;
}

export class AppStateManager {
  private state: AppStateData = {
    currentView: "library",
    currentBookId: null,
  };

  private listeners: Array<(state: AppStateData) => void> = [];

  getState(): AppStateData {
    return { ...this.state };
  }

  setState(partial: Partial<AppStateData>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: (state: AppStateData) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.getState()));
  }
}

export const appState = new AppStateManager();

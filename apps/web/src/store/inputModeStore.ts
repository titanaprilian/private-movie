import { create } from 'zustand';

export interface InputModeState {
  isSpatialMode: boolean;
  setSpatialMode: (isSpatialMode: boolean) => void;
}

export const useInputModeStore = create<InputModeState>((set) => ({
  isSpatialMode: false,
  setSpatialMode: (isSpatialMode) => set({ isSpatialMode }),
}));

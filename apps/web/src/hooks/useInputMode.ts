import { useEffect } from 'react';
import { useInputModeStore, type InputModeState } from '@/store/inputModeStore';

export type { InputModeState };
export { useInputModeStore };

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function useInputMode(): { isSpatialMode: boolean } {
  const isSpatialMode = useInputModeStore((state) => state.isSpatialMode);
  const setSpatialMode = useInputModeStore((state) => state.setSpatialMode);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (ARROW_KEYS.has(event.key)) {
        setSpatialMode(true);
      }
    };

    const handlePointer = () => {
      setSpatialMode(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handlePointer);
    window.addEventListener('touchstart', handlePointer);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handlePointer);
      window.removeEventListener('touchstart', handlePointer);
    };
  }, [setSpatialMode]);

  return { isSpatialMode };
}

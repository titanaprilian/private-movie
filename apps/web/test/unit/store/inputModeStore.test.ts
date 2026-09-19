import { describe, expect, it } from 'vitest';
import { useInputModeStore } from '@/store/inputModeStore';

describe('inputModeStore', () => {
  it('exports useInputModeStore from shared store module', () => {
    expect(useInputModeStore).toBeDefined();
    expect(useInputModeStore.getState().isSpatialMode).toBe(false);
    useInputModeStore.getState().setSpatialMode(true);
    expect(useInputModeStore.getState().isSpatialMode).toBe(true);
    useInputModeStore.getState().setSpatialMode(false);
  });
});

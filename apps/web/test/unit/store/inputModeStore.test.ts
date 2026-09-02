import { describe, expect, it } from 'vitest';
import { useInputMode, useInputModeStore } from '@/store/inputModeStore';

describe('inputModeStore re-exports', () => {
  it('exports useInputMode and useInputModeStore from shared store module', () => {
    expect(useInputMode).toBeDefined();
    expect(useInputModeStore).toBeDefined();
  });
});

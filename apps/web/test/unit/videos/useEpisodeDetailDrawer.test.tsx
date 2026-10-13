import { renderHook, act } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { useEpisodeDetailDrawer } from '@/modules/videos/internal/seasons';
import type { SeriesDetails } from '@/modules/videos/internal/api';

const mockEpisode = {
  id: 'ep-1',
  title: 'Pilot',
  description: 'First episode',
  duration: '24:15',
} as unknown as SeriesDetails['episodes'][number];

describe('useEpisodeDetailDrawer', () => {
  it('initializes form state from the episode', () => {
    const { result } = renderHook(() =>
      useEpisodeDetailDrawer({ episode: mockEpisode, onSave: vi.fn() })
    );
    expect(result.current.formState).toEqual({
      title: 'Pilot',
      description: 'First episode',
      duration: '24:15',
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('computes dirty state when a field changes and clears on discard', () => {
    const { result } = renderHook(() =>
      useEpisodeDetailDrawer({ episode: mockEpisode, onSave: vi.fn() })
    );
    act(() => {
      result.current.updateField('title', 'Pilot (edited)');
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.handleDiscard();
    });
    expect(result.current.formState.title).toBe('Pilot');
    expect(result.current.isDirty).toBe(false);
  });

  it('resyncs when the episode changes', () => {
    const { result, rerender } = renderHook(
      ({ episode }) => useEpisodeDetailDrawer({ episode, onSave: vi.fn() }),
      { initialProps: { episode: mockEpisode } }
    );
    act(() => {
      result.current.updateField('title', 'dirty');
    });
    const next = { ...mockEpisode, id: 'ep-2', title: 'Second' } as typeof mockEpisode;
    rerender({ episode: next });
    expect(result.current.formState.title).toBe('Second');
    expect(result.current.isDirty).toBe(false);
  });

  it('calls onSave with mapped payload on submit when dirty', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useEpisodeDetailDrawer({ episode: mockEpisode, onSave })
    );
    act(() => {
      result.current.updateField('description', 'Updated desc');
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(onSave).toHaveBeenCalledWith(
      'ep-1',
      expect.objectContaining({
        title: 'Pilot',
        description: 'Updated desc',
        duration: '24:15',
      })
    );
  });

  it('skips onSave when pristine or when saving is in progress', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useEpisodeDetailDrawer({ episode: mockEpisode, onSave, isSaving: true })
    );
    act(() => {
      result.current.updateField('title', 'changed');
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(onSave).not.toHaveBeenCalled();

    const onSave2 = vi.fn();
    const utils2 = renderHook(() =>
      useEpisodeDetailDrawer({ episode: mockEpisode, onSave: onSave2 })
    );
    await act(async () => {
      await utils2.result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(onSave2).not.toHaveBeenCalled();
  });
});

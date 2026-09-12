import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { renderWithProviders } from '../../../utils';

describe('Select Component', () => {
  it('renders trigger with placeholder and opens options on click', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Select defaultValue="s1">
        <SelectTrigger aria-label="Season">
          <SelectValue placeholder="Select a season" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Seasons</SelectLabel>
            <SelectItem value="s1">Season 1</SelectItem>
            <SelectItem value="s2">Season 2</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole('combobox', { name: /season/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('Season 1')).toBeInTheDocument();

    await user.click(trigger);

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Season 2' })
    ).toBeInTheDocument();
  });

  it('selects option when clicked and triggers onValueChange', async () => {
    const user = userEvent.setup();
    let selected = 's1';

    const { rerender } = renderWithProviders(
      <Select
        value={selected}
        onValueChange={(val) => {
          selected = val;
        }}
      >
        <SelectTrigger aria-label="Season">
          <SelectValue placeholder="Select a season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="s1">Season 1</SelectItem>
          <SelectItem value="s2">Season 2</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole('combobox', { name: /season/i });
    await user.click(trigger);

    const option2 = await screen.findByRole('option', { name: 'Season 2' });
    await user.click(option2);

    expect(selected).toBe('s2');

    rerender(
      <Select
        value={selected}
        onValueChange={(val) => {
          selected = val;
        }}
      >
        <SelectTrigger aria-label="Season">
          <SelectValue placeholder="Select a season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="s1">Season 1</SelectItem>
          <SelectItem value="s2">Season 2</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByText('Season 2')).toBeInTheDocument();
  });
});

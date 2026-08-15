import '@testing-library/jest-dom';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

/**
 * Custom render function that wraps components with shared application providers.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderWithProvidersOptions
) {
  const { queryClient: clientOption, ...renderOpts } = options ?? {};
  const queryClient = clientOption ?? createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', null, 'Loading...') },
        children
      )
    );

  return {
    user: userEvent.setup(),
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOpts }),
  };
}

export * from '@testing-library/react';
export { userEvent };

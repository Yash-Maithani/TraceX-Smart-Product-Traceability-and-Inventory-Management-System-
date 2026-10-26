import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProductsPage } from './ProductsPage';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { ProductDto, UserSummaryDto } from '../../api/types';

const MANAGER: UserSummaryDto = { id: 'u-mgr', username: 'manager', name: 'Ops Manager', role: 'manager', superAdmin: false, active: true };
const FACTORY: UserSummaryDto = { id: 'u-fm', username: 'fm', name: 'Factory', role: 'factory-manager', superAdmin: false, active: true };

const PRODUCTS: ProductDto[] = [
  { id: 'p1', productName: 'Apricot & Berry Himalayan Jam', sku: 'ABHJAM', category: 'Spreads', baseShelfLifeDays: 365, riskLevel: 'MEDIUM', allergens: [] },
  { id: 'p2', productName: 'Wild Berry Juice Concentrate', sku: 'WBJC', category: 'Beverages', baseShelfLifeDays: 180, riskLevel: 'LOW', allergens: ['Sulphites'] }
];

function mockAuth(user: UserSummaryDto) {
  vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
    user,
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    setAuthenticatedSession: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    refreshSession: vi.fn().mockResolvedValue(undefined)
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return render(<ProductsPage />, { wrapper: wrap });
}

describe('ProductsPage (product catalogue)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(Endpoints, 'fetchProducts').mockResolvedValue(PRODUCTS);
  });

  it('lists products with shelf life, priority and allergens; a factory manager gets no edit controls', async () => {
    mockAuth(FACTORY);
    renderPage();
    expect((await screen.findAllByText('Wild Berry Juice Concentrate')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('365 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sulphites').length).toBeGreaterThan(0);
    expect(screen.getByTestId('products-count')).toHaveTextContent('2 products');
    expect(screen.queryByTestId('add-product-btn')).toBeNull();
    expect(screen.queryByTestId('edit-product-WBJC')).toBeNull();
  });

  it('search filters by SKU', async () => {
    mockAuth(FACTORY);
    renderPage();
    await screen.findAllByText('Wild Berry Juice Concentrate');
    fireEvent.change(screen.getByTestId('products-search'), { target: { value: 'abhjam' } });
    expect(screen.queryAllByText('Wild Berry Juice Concentrate')).toHaveLength(0);
    expect(screen.getAllByText('Apricot & Berry Himalayan Jam').length).toBeGreaterThan(0);
  });

  it('a manager adds a product; the SKU is upper-cased and allergens split on commas', async () => {
    mockAuth(MANAGER);
    const create = vi.spyOn(Endpoints, 'createProduct').mockResolvedValue({ id: 'p3', productName: 'Rhododendron Squash', sku: 'RSQ' });
    renderPage();
    fireEvent.click(await screen.findByTestId('add-product-btn'));
    fireEvent.change(screen.getByTestId('product-name'), { target: { value: 'Rhododendron Squash' } });
    fireEvent.change(screen.getByTestId('product-sku'), { target: { value: 'rsq' } });
    fireEvent.change(screen.getByTestId('product-category'), { target: { value: 'Beverages' } });
    fireEvent.change(screen.getByTestId('product-shelf-life'), { target: { value: '240' } });
    fireEvent.change(screen.getByTestId('product-allergens'), { target: { value: 'nuts, gluten, Nuts' } });
    fireEvent.click(screen.getByTestId('product-save-btn'));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0]).toMatchObject({
      productName: 'Rhododendron Squash',
      sku: 'RSQ',
      shelfLifeDays: 240,
      riskLevel: 'LOW',
      allergens: ['nuts', 'gluten']
    });
  });

  it('editing keeps the SKU read-only and shows a server field error under the field', async () => {
    mockAuth(MANAGER);
    vi.spyOn(Endpoints, 'updateProduct').mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fieldErrors: [{ field: 'category', message: 'size must be between 0 and 40' }]
      })
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('edit-product-WBJC'));
    expect(screen.getByTestId('product-sku')).toHaveAttribute('readonly');
    expect(screen.getByTestId('product-shelf-life')).toHaveValue(180);
    fireEvent.click(screen.getByTestId('product-save-btn'));
    expect(await screen.findByText('size must be between 0 and 40')).toBeInTheDocument();
  });
});

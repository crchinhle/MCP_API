import type { Product } from '../../domain/product';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AdminPlanDto,
  AdminProductDto,
  CreatePlanDto,
  CreateProductDto,
  ComparePlansResponseDto,
  PublicCatalogProductDto,
  UpdatePlanDto,
  UpdateProductDto,
} from '../../infrastructure/api/generated';
import { requestJson } from '../auth/authContext';

export type AdminProduct = AdminProductDto;
export type AdminPlan = AdminPlanDto;

function mapProduct(product: PublicCatalogProductDto): Product {
  return {
    imageUrl: product.imageUrl ?? null,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    tone: 'brand',
    plans: product.plans.map((plan) => ({
      id: plan.id,
      devices: plan.maxActiveDevices,
      label: plan.name,
      priceVnd: plan.priceVnd,
      durationMonths: plan.durationMonths,
      entitlements: plan.entitlements,
    })),
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ['products', 'public'],
    queryFn: async () =>
      (await requestJson<PublicCatalogProductDto[]>('/products')).map(mapProduct),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['products', 'public', slug],
    queryFn: async () =>
      mapProduct(
        await requestJson<PublicCatalogProductDto>(`/products/${encodeURIComponent(slug)}`),
      ),
    enabled: Boolean(slug),
  });
}

export function useComparePlans(ids: readonly string[]) {
  const comparisonKey = ids.join(',');
  return useQuery({
    queryKey: ['plans', 'compare', comparisonKey],
    queryFn: () =>
      requestJson<ComparePlansResponseDto>(
        `/plans/compare?ids=${encodeURIComponent(comparisonKey)}`,
      ),
    enabled: ids.length >= 2 && ids.length <= 4,
  });
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['products', 'admin'],
    queryFn: () => requestJson<AdminProduct[]>('/products/admin'),
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ['plans', 'admin'],
    queryFn: () => requestJson<AdminPlan[]>('/plans'),
  });
}

export type ProductInput = CreateProductDto;
export type ProductUpdateInput = UpdateProductDto;
export type PlanInput = CreatePlanDto;
export type PlanUpdateInput = UpdatePlanDto;

async function mutateCatalog<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  return requestJson<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function useCatalogMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['products', 'admin'] });
    void queryClient.invalidateQueries({ queryKey: ['plans', 'admin'] });
    void queryClient.invalidateQueries({ queryKey: ['products', 'public'] });
  };
  return {
    createProduct: useMutation({
      mutationFn: (input: ProductInput) =>
        mutateCatalog<AdminProduct>('/products', 'POST', input),
      onSuccess: refresh,
    }),
    updateProduct: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ProductUpdateInput }) =>
        mutateCatalog<AdminProduct>(`/products/${id}`, 'PUT', input),
      onSuccess: refresh,
    }),
    deleteProduct: useMutation({
      mutationFn: (id: string) =>
        mutateCatalog<{ deleted: boolean }>(`/products/${id}`, 'DELETE'),
      onSuccess: refresh,
    }),
    publishProduct: useMutation({
      mutationFn: (id: string) =>
        mutateCatalog<AdminProduct>(`/products/${id}/publish`, 'POST'),
      onSuccess: refresh,
    }),
    archiveProduct: useMutation({
      mutationFn: (id: string) =>
        mutateCatalog<AdminProduct>(`/products/${id}/archive`, 'POST'),
      onSuccess: refresh,
    }),
    createPlan: useMutation({
      mutationFn: (input: PlanInput) => mutateCatalog<AdminPlan>('/plans', 'POST', input),
      onSuccess: refresh,
    }),
    updatePlan: useMutation({
      mutationFn: ({ id, input }: { id: string; input: PlanUpdateInput }) =>
        mutateCatalog<AdminPlan>(`/plans/${id}`, 'PUT', input),
      onSuccess: refresh,
    }),
    deletePlan: useMutation({
      mutationFn: (id: string) =>
        mutateCatalog<{ deleted: boolean }>(`/plans/${id}`, 'DELETE'),
      onSuccess: refresh,
    }),
    publishPlan: useMutation({
      mutationFn: (id: string) =>
        mutateCatalog<AdminPlan>(`/plans/${id}/publish`, 'POST'),
      onSuccess: refresh,
    }),
    archivePlan: useMutation({
      mutationFn: (id: string) =>
        mutateCatalog<AdminPlan>(`/plans/${id}/archive`, 'POST'),
      onSuccess: refresh,
    }),
  };
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
}

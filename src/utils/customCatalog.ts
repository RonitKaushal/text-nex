import { storage } from './storage';
import type { CatalogService, ServiceCategoryDef } from '../types';

const CATEGORIES_KEY = 'customCategories';
const CATALOG_KEY = 'customServiceCatalog';

export async function loadCustomCategories(): Promise<ServiceCategoryDef[]> {
  const data = await storage.loadData(CATEGORIES_KEY);
  return Array.isArray(data) ? (data as ServiceCategoryDef[]) : [];
}

export async function saveCustomCategories(categories: ServiceCategoryDef[]): Promise<void> {
  await storage.saveData(CATEGORIES_KEY, categories);
}

export async function loadCustomCatalog(): Promise<CatalogService[]> {
  const data = await storage.loadData(CATALOG_KEY);
  return Array.isArray(data) ? (data as CatalogService[]) : [];
}

export async function saveCustomCatalog(services: CatalogService[]): Promise<void> {
  await storage.saveData(CATALOG_KEY, services);
}

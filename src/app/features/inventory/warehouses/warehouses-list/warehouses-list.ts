import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  StorageLocationRequest,
  StorageLocationResponse,
  WarehouseCreateRequest,
  WarehouseResponse,
  WarehousesService,
  WarehouseUpdateRequest,
} from '../../../../generated';
 
interface NewWarehouseForm {
  code: string;
  name: string;
}
 
const EMPTY_FORM: NewWarehouseForm = { code: '', name: '' };
 
@Component({
  selector: 'app-warehouses-list',
  imports: [],
  templateUrl: './warehouses-list.html',
  styleUrl: './warehouses-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class WarehousesListComponent implements OnInit {
  private readonly warehousesService = inject(WarehousesService);
 
  readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly locationsByWarehouse = signal<Record<number, StorageLocationResponse[]>>({});
  readonly expandedIds = signal<Set<number>>(new Set());
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
 
  readonly isNewOpen = signal(false);
  readonly newForm = signal<NewWarehouseForm>({ ...EMPTY_FORM });
  readonly creatingWarehouse = signal(false);
  readonly newFormError = signal<string | null>(null);
 
  readonly togglingActiveFor = signal<number | null>(null);
 
  readonly newLocCodeByWarehouse = signal<Record<number, string>>({});
  readonly addingLocationFor = signal<number | null>(null);
  readonly removingLocationId = signal<number | null>(null);
 
  ngOnInit(): void {
    this.fetchAll();
  }
 
  isExpanded(warehouseId: number): boolean {
    return this.expandedIds().has(warehouseId);
  }
 
  toggleExpand(warehouseId: number): void {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      next.has(warehouseId) ? next.delete(warehouseId) : next.add(warehouseId);
      return next;
    });
  }
 
  locationsFor(warehouseId: number): StorageLocationResponse[] {
    return this.locationsByWarehouse()[warehouseId] ?? [];
  }
 
  locationCount(warehouseId: number): number {
    return this.locationsFor(warehouseId).length;
  }
 
  deactivateLabel(warehouse: WarehouseResponse): string {
    return warehouse.active ? 'Deactivate' : 'Reactivate';
  }
 
  // ---- Create warehouse ----
 
  openNew(): void {
    this.newForm.set({ ...EMPTY_FORM });
    this.newFormError.set(null);
    this.isNewOpen.set(true);
  }
 
  closeNew(): void {
    this.isNewOpen.set(false);
  }
 
  onNewCodeChange(value: string): void {
    this.newForm.update((f) => ({ ...f, code: value }));
  }
 
  onNewNameChange(value: string): void {
    this.newForm.update((f) => ({ ...f, name: value }));
  }
 
  saveNewWarehouse(): void {
    const f = this.newForm();
    if (!f.code.trim() || !f.name.trim()) {
      this.newFormError.set('Code and Name are required.');
      return;
    }
 
    this.creatingWarehouse.set(true);
    this.newFormError.set(null);
 
    const body: WarehouseCreateRequest = { code: f.code.trim(), name: f.name.trim() };
 
    this.warehousesService.createWarehouse(body).subscribe({
      next: (created) => {
        this.creatingWarehouse.set(false);
        this.isNewOpen.set(false);
        this.warehouses.update((list) => [created, ...list]);
        if (created.id !== undefined) {
          this.locationsByWarehouse.update((map) => ({ ...map, [created.id!]: [] }));
        }
      },
      error: (err) => {
        this.creatingWarehouse.set(false);
        this.newFormError.set(
          err?.status === 409 ? 'A warehouse with this code already exists.' : 'Could not create warehouse.',
        );
      },
    });
  }
 
  // ---- Active / inactive toggle ----
  // Deactivate uses the dedicated PATCH endpoint (one-way). Reactivate goes
  // through the general update endpoint with active: true — there's no
  // separate reactivate route, same pattern as Suppliers. The warehouse
  // code is immutable and isn't included in this request.
 
  toggleWarehouseActive(warehouse: WarehouseResponse, event: Event): void {
    event.stopPropagation();
    if (warehouse.id === undefined) return;
 
    this.togglingActiveFor.set(warehouse.id);
    const request$ = warehouse.active
      ? this.warehousesService.deactivateWarehouse(warehouse.id)
      : this.warehousesService.updateWarehouse(warehouse.id, { active: true } satisfies WarehouseUpdateRequest);
 
    request$.subscribe({
      next: () => {
        this.togglingActiveFor.set(null);
        this.warehouses.update((list) =>
          list.map((w) => (w.id === warehouse.id ? { ...w, active: !warehouse.active } : w)),
        );
      },
      error: () => {
        this.togglingActiveFor.set(null);
        this.errorMessage.set('Could not update warehouse status. Please try again.');
      },
    });
  }
 
  // ---- Storage locations ----
 
  newLocCodeFor(warehouseId: number): string {
    return this.newLocCodeByWarehouse()[warehouseId] ?? '';
  }
 
  onNewLocCodeChange(warehouseId: number, value: string): void {
    this.newLocCodeByWarehouse.update((map) => ({ ...map, [warehouseId]: value }));
  }
 
  addLocation(warehouseId: number, event: Event): void {
    event.stopPropagation();
    const code = this.newLocCodeFor(warehouseId).trim();
    if (!code) return;
 
    this.addingLocationFor.set(warehouseId);
    const body: StorageLocationRequest = { warehouseId, code };
 
    this.warehousesService.addStorageLocation(body).subscribe({
      next: (location) => {
        this.addingLocationFor.set(null);
        this.locationsByWarehouse.update((map) => ({
          ...map,
          [warehouseId]: [...(map[warehouseId] ?? []), location],
        }));
        this.newLocCodeByWarehouse.update((map) => ({ ...map, [warehouseId]: '' }));
      },
      error: (err) => {
        this.addingLocationFor.set(null);
        this.errorMessage.set(
          err?.status === 409
            ? 'A storage location with this code already exists in this warehouse.'
            : 'Could not add storage location.',
        );
      },
    });
  }
 
  // Soft-deletes the location — the API deactivates rather than hard-
  // deletes, preserving history on any InventoryStock/StockMovement rows
  // that reference it. Removed from the local list optimistically since
  // the list endpoint only returns active locations by default anyway.
  removeLocation(warehouseId: number, locationId: number | undefined, event: Event): void {
    event.stopPropagation();
    if (locationId === undefined) return;
 
    this.removingLocationId.set(locationId);
    this.warehousesService.deactivateStorageLocation(locationId).subscribe({
      next: () => {
        this.removingLocationId.set(null);
        this.locationsByWarehouse.update((map) => ({
          ...map,
          [warehouseId]: (map[warehouseId] ?? []).filter((loc) => loc.id !== locationId),
        }));
      },
      error: () => {
        this.removingLocationId.set(null);
        this.errorMessage.set('Could not remove storage location. Please try again.');
      },
    });
  }
 
  private fetchAll(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
 
    this.warehousesService.listWarehouses(undefined, 0, 200, undefined).subscribe({
      next: (result) => {
        const list = result.content ?? [];
        this.warehouses.set(list);
        this.fetchLocationsFor(list);
      },
      error: () => {
        this.errorMessage.set('Could not load warehouses. Please try again.');
        this.loading.set(false);
      },
    });
  }
 
  private fetchLocationsFor(list: WarehouseResponse[]): void {
    const withIds = list.filter((w): w is WarehouseResponse & { id: number } => w.id !== undefined);
 
    if (withIds.length === 0) {
      this.loading.set(false);
      return;
    }
 
    forkJoin(
      withIds.map((w) =>
        this.warehousesService.listStorageLocations(w.id, true).pipe(
          catchError(() => of([] as StorageLocationResponse[])),
        ),
      ),
    ).subscribe((results) => {
      const map: Record<number, StorageLocationResponse[]> = {};
      withIds.forEach((w, i) => {
        map[w.id] = Array.isArray(results[i]) ? results[i] : [];
      });
      this.locationsByWarehouse.set(map);
      this.loading.set(false);
    });
  }
}
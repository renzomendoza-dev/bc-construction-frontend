import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  EquipmentAssignmentBatchCreateRequest,
  EquipmentAssignmentBatchLineRequest,
  EquipmentAssignmentBatchesService,
  EquipmentResponse,
  EquipmentService,
  UserResponse,
  UserService,
  WarehouseResponse,
  WarehousesService,
} from '../../../generated';

type Direction = 'ASSIGN' | 'RETURN';

interface DraftLine {
  equipmentId: number | null;
  conditionNotes: string;
}

function emptyLine(): DraftLine {
  return { equipmentId: null, conditionNotes: '' };
}

@Component({
  selector: 'app-equipment-assignment-batch-create',
  imports: [],
  templateUrl: './equipment-assignment-batch-create.html',
  styleUrl: './equipment-assignment-batch-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentAssignmentBatchCreateComponent implements OnInit {
  private readonly batchesService = inject(EquipmentAssignmentBatchesService);
  private readonly equipmentService = inject(EquipmentService);
  private readonly usersService = inject(UserService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly router = inject(Router);

  // The Equipment module's endpoints declare their response content-type as
  // `*/*` in the OpenAPI spec, so the generated client falls back to
  // `responseType: 'blob'`. Forcing the Accept header routes it back onto
  // the JSON parsing path — same workaround as equipment-list.ts.
  private readonly jsonAccept = { httpHeaderAccept: 'application/json' } as unknown as {
    httpHeaderAccept?: '*/*';
  };

  readonly direction = signal<Direction>('ASSIGN');

  readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly equipment = signal<EquipmentResponse[]>([]);
  readonly users = signal<UserResponse[]>([]);
  readonly loadingOptions = signal(true);

  readonly destinationWarehouseId = signal<number | null>(null);
  readonly holderId = signal<number | null>(null);
  readonly notes = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Destination options are filtered by the warehouse's own type — a SITE
  // warehouse is only a valid destination for an assign-out batch, a MAIN
  // warehouse only for a return batch (mirrors the backend's own derivation
  // of direction from destinationWarehouseId's type).
  readonly destinationOptions = computed(() =>
    this.direction() === 'ASSIGN'
      ? this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Site)
      : this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Main),
  );

  // Equipment options are filtered to whatever status is actually valid for
  // this batch's direction — a client-side early warning, same idea as the
  // stock-shortfall hint on transfer-batch-create. The backend is still the
  // authority at submit() time.
  readonly equipmentOptions = computed(() =>
    this.direction() === 'ASSIGN'
      ? this.equipment().filter((e) => e.status === EquipmentResponse.StatusEnum.Available)
      : this.equipment().filter(
          (e) =>
            e.status === EquipmentResponse.StatusEnum.CheckedOut || e.status === EquipmentResponse.StatusEnum.InUse,
        ),
  );

  readonly totalLineCount = computed(() => this.lines().filter((l) => l.equipmentId !== null).length);

  ngOnInit(): void {
    this.loadOptions();
  }

  backToList(): void {
    this.router.navigate(['/equipment/assignment-batches']);
  }

  equipmentLabel(eq: EquipmentResponse): string {
    return `${eq.name} (${eq.assetTag})`;
  }

  setDirection(direction: Direction): void {
    if (this.direction() === direction) return;
    this.direction.set(direction);
    // Destination/holder/lines are direction-specific — clear them rather
    // than carry over a selection that's no longer a valid option.
    this.destinationWarehouseId.set(null);
    this.holderId.set(null);
    this.lines.set([emptyLine()]);
  }

  onDestinationChange(value: string): void {
    this.destinationWarehouseId.set(value ? Number(value) : null);
  }

  onHolderChange(value: string): void {
    this.holderId.set(value ? Number(value) : null);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  onLineEquipmentChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, equipmentId: value ? Number(value) : null } : r)),
    );
  }

  onLineConditionChange(index: number, value: string): void {
    this.lines.update((rows) => rows.map((r, i) => (i === index ? { ...r, conditionNotes: value } : r)));
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, emptyLine()]);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  saveDraft(): void {
    const destinationWarehouseId = this.destinationWarehouseId();
    const validLines = this.lines().filter((l) => l.equipmentId !== null);

    if (!destinationWarehouseId) {
      this.errorMessage.set(`Select the ${this.direction() === 'ASSIGN' ? 'destination site' : 'destination warehouse'}.`);
      return;
    }
    if (this.direction() === 'ASSIGN' && !this.holderId()) {
      this.errorMessage.set('Select who is taking custody of this equipment.');
      return;
    }
    if (validLines.length === 0) {
      this.errorMessage.set('At least one piece of equipment is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: EquipmentAssignmentBatchCreateRequest = {
      destinationWarehouseId,
      holderId: this.direction() === 'ASSIGN' ? (this.holderId() ?? undefined) : undefined,
      notes: this.notes().trim() || undefined,
      lines: validLines.map(
        (l): EquipmentAssignmentBatchLineRequest => ({
          equipmentId: l.equipmentId!,
          conditionNotes: l.conditionNotes.trim() || undefined,
        }),
      ),
    };

    this.batchesService.createDraft1(body, 'body', undefined, this.jsonAccept).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/equipment/assignment-batches', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(
          err?.error?.message ||
            (err?.status === 404
              ? 'The selected warehouse, holder, or one of the selected equipment items could not be found.'
              : 'Could not create this batch. Please check the form and try again.'),
        );
      },
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);

    forkJoin({
      warehouses: this.warehousesService.listWarehouses(true, 0, 200, undefined),
      equipment: this.equipmentService.findAll(undefined, 'body', undefined, this.jsonAccept),
      users: this.usersService.findAll2(undefined, undefined, this.jsonAccept),
    }).subscribe({
      next: ({ warehouses, equipment, users }) => {
        this.warehouses.set(warehouses.content ?? []);
        // Same live-spec typing caveat as equipment-list.ts's fetchEquipment()
        // — findAll is documented as returning a single EquipmentResponse
        // rather than an array, which looks like a springdoc regression from
        // the new assignment-batches controller. Still a JSON array at
        // runtime, hence the cast.
        this.equipment.set((equipment as unknown as EquipmentResponse[]) ?? []);
        this.users.set(users ?? []);
        this.loadingOptions.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load warehouses, equipment, or users.');
        this.loadingOptions.set(false);
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import {
  EquipmentCheckInRequest,
  EquipmentCheckOutRequest,
  EquipmentCreateRequest,
  EquipmentResponse,
  EquipmentService,
  EquipmentUpdateRequest,
  UserResponse,
  UserService,
} from '../../../generated';

type Tab = 'all' | 'overdue';

const STATUSES: EquipmentResponse.StatusEnum[] = [
  'AVAILABLE',
  'CHECKED_OUT',
  'IN_REPAIR',
  'RETIRED',
  'LOST',
  'MAINTENANCE',
  'IN_USE',
];

const OVERDUE_DAY_OPTIONS = ['3', '7', '14', '30'];

interface NewEquipmentForm {
  name: string;
  assetTag: string;
  category: string;
  serialNumber: string;
  purchasePrice: string;
}

const EMPTY_NEW_FORM: NewEquipmentForm = {
  name: '',
  assetTag: '',
  category: '',
  serialNumber: '',
  purchasePrice: '',
};

interface EditEquipmentForm {
  name: string;
  category: string;
  serialNumber: string;
  purchasePrice: string;
  purchaseDate: string;
  purchaseVendor: string;
}

const EMPTY_EDIT_FORM: EditEquipmentForm = {
  name: '',
  category: '',
  serialNumber: '',
  purchasePrice: '',
  purchaseDate: '',
  purchaseVendor: '',
};

@Component({
  selector: 'app-equipment-list',
  imports: [DatePipe, NgClass],
  templateUrl: './equipment-list.html',
  styleUrl: './equipment-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentListComponent implements OnInit {
  private readonly equipmentService = inject(EquipmentService);
  private readonly userService = inject(UserService);

  // The Equipment endpoints declare their response content-type as `*/*` in
  // the OpenAPI spec (unlike the rest of the API, which uses
  // `application/json`), so the generated client can't tell they're JSON and
  // falls back to `responseType: 'blob'`. Forcing the Accept header here
  // routes it back onto the JSON parsing path. The options type only allows
  // the literal `'*/*'`, hence the cast.
  private readonly jsonAccept = { httpHeaderAccept: 'application/json' } as unknown as {
    httpHeaderAccept?: '*/*';
  };

  readonly statuses = STATUSES;
  readonly overdueDayOptions = OVERDUE_DAY_OPTIONS;

  // ---- Tab / list state ----------------------------------------------
  readonly tab = signal<Tab>('all');
  readonly search = signal('');
  readonly statusFilter = signal<'all' | EquipmentResponse.StatusEnum>('all');

  readonly equipment = signal<EquipmentResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly overdueDays = signal('7');
  readonly overdueEquipment = signal<EquipmentResponse[]>([]);
  readonly overdueLoading = signal(false);
  readonly overdueError = signal<string | null>(null);

  readonly filteredEquipment = computed(() => {
    const status = this.statusFilter();
    const search = this.search().trim().toLowerCase();
    return this.equipment().filter((eq) => {
      if (status !== 'all' && eq.status !== status) return false;
      if (
        search &&
        !(eq.name ?? '').toLowerCase().includes(search) &&
        !(eq.assetTag ?? '').toLowerCase().includes(search) &&
        !(eq.serialNumber ?? '').toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });
  });

  readonly overdueCount = computed(() => this.overdueEquipment().length);

  // ---- Users (for the check-out picker) ----------------------------------
  readonly users = signal<UserResponse[]>([]);
  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);

  // ---- Check-out modal --------------------------------------------------
  readonly checkOutOpen = signal(false);
  readonly checkOutTarget = signal<EquipmentResponse | null>(null);
  readonly checkOutUserId = signal('');
  readonly checkOutSite = signal('');
  readonly checkOutCondition = signal('');
  readonly checkOutSaving = signal(false);
  readonly checkOutError = signal<string | null>(null);

  // ---- Check-in modal -----------------------------------------------------
  readonly checkInOpen = signal(false);
  readonly checkInTarget = signal<EquipmentResponse | null>(null);
  readonly checkInCondition = signal('');
  readonly checkInSaving = signal(false);
  readonly checkInError = signal<string | null>(null);

  // ---- New equipment modal ------------------------------------------------
  readonly newOpen = signal(false);
  readonly newForm = signal<NewEquipmentForm>({ ...EMPTY_NEW_FORM });
  readonly newSaving = signal(false);
  readonly newError = signal<string | null>(null);

  // ---- Edit equipment modal ------------------------------------------------
  readonly editOpen = signal(false);
  readonly editTarget = signal<EquipmentResponse | null>(null);
  readonly editForm = signal<EditEquipmentForm>({ ...EMPTY_EDIT_FORM });
  readonly editSaving = signal(false);
  readonly editError = signal<string | null>(null);

  ngOnInit(): void {
    this.fetchEquipment();
    this.fetchOverdue();
    this.fetchUsers();
  }

  // ---- Tabs -----------------------------------------------------------
  selectTab(tab: Tab): void {
    this.tab.set(tab);
  }

  onSearchChange(value: string): void {
    this.search.set(value);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set((value as 'all' | EquipmentResponse.StatusEnum) ?? 'all');
  }

  onOverdueDaysChange(value: string): void {
    this.overdueDays.set(value);
    this.fetchOverdue();
  }

  // ---- Display helpers --------------------------------------------------
  statusLabel(status: EquipmentResponse.StatusEnum | undefined): string {
    if (!status) return '—';
    return status
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  statusBadgeClass(status: EquipmentResponse.StatusEnum | undefined): string {
    switch (status) {
      case 'AVAILABLE':
        return 'status-badge--available';
      case 'CHECKED_OUT':
      case 'IN_USE':
        return 'status-badge--active';
      case 'IN_REPAIR':
      case 'LOST':
        return 'status-badge--alert';
      default:
        return 'status-badge--neutral';
    }
  }

  holderLabel(eq: EquipmentResponse): string {
    if (!eq.currentHolderName) return '—';
    return eq.currentSite ? `${eq.currentHolderName} · ${eq.currentSite}` : eq.currentHolderName;
  }

  canCheckOut(eq: EquipmentResponse): boolean {
    return eq.status === 'AVAILABLE';
  }

  canCheckIn(eq: EquipmentResponse): boolean {
    return eq.status === 'CHECKED_OUT' || eq.status === 'IN_USE';
  }

  daysOut(eq: EquipmentResponse): number {
    if (!eq.checkedOutAt) return 0;
    const checkedOut = new Date(eq.checkedOutAt).getTime();
    const diff = Date.now() - checkedOut;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  // ---- Check-out ------------------------------------------------------
  openCheckOut(eq: EquipmentResponse): void {
    this.checkOutTarget.set(eq);
    this.checkOutUserId.set('');
    this.checkOutSite.set('');
    this.checkOutCondition.set('');
    this.checkOutError.set(null);
    this.checkOutOpen.set(true);
  }

  closeCheckOut(): void {
    this.checkOutOpen.set(false);
  }

  onCheckOutUserIdChange(value: string): void {
    this.checkOutUserId.set(value);
  }

  onCheckOutSiteChange(value: string): void {
    this.checkOutSite.set(value);
  }

  onCheckOutConditionChange(value: string): void {
    this.checkOutCondition.set(value);
  }

  submitCheckOut(): void {
    const target = this.checkOutTarget();
    if (!target?.id) return;

    const userId = Number(this.checkOutUserId());
    const site = this.checkOutSite().trim();
    if (!userId || Number.isNaN(userId)) {
      this.checkOutError.set('Select a user.');
      return;
    }
    if (!site) {
      this.checkOutError.set('Site is required.');
      return;
    }

    const request: EquipmentCheckOutRequest = {
      userId,
      site,
      conditionOut: this.checkOutCondition().trim() || undefined,
    };

    this.checkOutSaving.set(true);
    this.checkOutError.set(null);
    this.equipmentService.checkOut(target.id, request, 'body', undefined, this.jsonAccept).subscribe({
      next: () => {
        this.checkOutSaving.set(false);
        this.checkOutOpen.set(false);
        this.fetchEquipment();
        this.fetchOverdue();
      },
      error: () => {
        this.checkOutSaving.set(false);
        this.checkOutError.set('Could not check out this equipment. Please try again.');
      },
    });
  }

  // ---- Check-in ---------------------------------------------------------
  openCheckIn(eq: EquipmentResponse): void {
    this.checkInTarget.set(eq);
    this.checkInCondition.set('');
    this.checkInError.set(null);
    this.checkInOpen.set(true);
  }

  closeCheckIn(): void {
    this.checkInOpen.set(false);
  }

  onCheckInConditionChange(value: string): void {
    this.checkInCondition.set(value);
  }

  submitCheckIn(): void {
    const target = this.checkInTarget();
    if (!target?.id) return;

    const request: EquipmentCheckInRequest = {
      conditionIn: this.checkInCondition().trim() || undefined,
    };

    this.checkInSaving.set(true);
    this.checkInError.set(null);
    this.equipmentService.checkIn(target.id, request, 'body', undefined, this.jsonAccept).subscribe({
      next: () => {
        this.checkInSaving.set(false);
        this.checkInOpen.set(false);
        this.fetchEquipment();
        this.fetchOverdue();
      },
      error: () => {
        this.checkInSaving.set(false);
        this.checkInError.set('Could not check in this equipment. Please try again.');
      },
    });
  }

  // ---- New equipment ------------------------------------------------------
  openNew(): void {
    this.newForm.set({ ...EMPTY_NEW_FORM });
    this.newError.set(null);
    this.newOpen.set(true);
  }

  closeNew(): void {
    this.newOpen.set(false);
  }

  onNewFieldChange<K extends keyof NewEquipmentForm>(field: K, value: string): void {
    this.newForm.update((form) => ({ ...form, [field]: value }));
  }

  submitNew(): void {
    const form = this.newForm();
    const name = form.name.trim();
    const assetTag = form.assetTag.trim();
    if (!name || !assetTag) {
      this.newError.set('Name and asset tag are required.');
      return;
    }

    const purchasePrice = form.purchasePrice.trim() ? Number(form.purchasePrice) : undefined;
    if (purchasePrice !== undefined && Number.isNaN(purchasePrice)) {
      this.newError.set('Purchase price must be a number.');
      return;
    }

    const request: EquipmentCreateRequest = {
      name,
      assetTag,
      category: form.category.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      purchasePrice,
    };

    this.newSaving.set(true);
    this.newError.set(null);
    this.equipmentService.create(request, 'body', undefined, this.jsonAccept).subscribe({
      next: () => {
        this.newSaving.set(false);
        this.newOpen.set(false);
        this.fetchEquipment();
      },
      error: () => {
        this.newSaving.set(false);
        this.newError.set('Could not create this equipment. Please check the fields and try again.');
      },
    });
  }

  // ---- Edit equipment -------------------------------------------------
  openEdit(eq: EquipmentResponse): void {
    this.editTarget.set(eq);
    this.editForm.set({
      name: eq.name ?? '',
      category: eq.category ?? '',
      serialNumber: eq.serialNumber ?? '',
      purchasePrice: eq.purchasePrice !== undefined && eq.purchasePrice !== null ? String(eq.purchasePrice) : '',
      purchaseDate: eq.purchaseDate ?? '',
      purchaseVendor: eq.purchaseVendor ?? '',
    });
    this.editError.set(null);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
  }

  onEditFieldChange<K extends keyof EditEquipmentForm>(field: K, value: string): void {
    this.editForm.update((form) => ({ ...form, [field]: value }));
  }

  submitEdit(): void {
    const target = this.editTarget();
    if (!target?.id) return;

    const form = this.editForm();
    const name = form.name.trim();
    if (!name) {
      this.editError.set('Name is required.');
      return;
    }

    const purchasePrice = form.purchasePrice.trim() ? Number(form.purchasePrice) : undefined;
    if (purchasePrice !== undefined && Number.isNaN(purchasePrice)) {
      this.editError.set('Purchase price must be a number.');
      return;
    }

    const request: EquipmentUpdateRequest = {
      name,
      category: form.category.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      purchasePrice,
      purchaseDate: form.purchaseDate.trim() || undefined,
      purchaseVendor: form.purchaseVendor.trim() || undefined,
    };

    this.editSaving.set(true);
    this.editError.set(null);
    this.equipmentService.update(target.id, request, 'body', undefined, this.jsonAccept).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.editOpen.set(false);
        this.fetchEquipment();
        this.fetchOverdue();
      },
      error: () => {
        this.editSaving.set(false);
        this.editError.set('Could not update this equipment. Please check the fields and try again.');
      },
    });
  }

  // ---- Data fetching ------------------------------------------------------
  private fetchEquipment(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.equipmentService.findAll(undefined, 'body', undefined, this.jsonAccept).subscribe({
      next: (result) => {
        this.equipment.set(result ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load equipment. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private fetchOverdue(): void {
    const days = Number(this.overdueDays());
    this.overdueLoading.set(true);
    this.overdueError.set(null);
    this.equipmentService.findOverdue(days, 'body', undefined, this.jsonAccept).subscribe({
      next: (result) => {
        this.overdueEquipment.set(
          [...(result ?? [])].sort((a, b) => this.daysOut(b) - this.daysOut(a)),
        );
        this.overdueLoading.set(false);
      },
      error: () => {
        this.overdueError.set('Could not load overdue equipment. Please try again.');
        this.overdueLoading.set(false);
      },
    });
  }

  private fetchUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);
    this.userService.findAll1(undefined, undefined, this.jsonAccept).subscribe({
      next: (result) => {
        this.users.set(
          [...(result ?? [])].sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '')),
        );
        this.usersLoading.set(false);
      },
      error: () => {
        this.usersError.set('Could not load users for the check-out picker.');
        this.usersLoading.set(false);
      },
    });
  }
}

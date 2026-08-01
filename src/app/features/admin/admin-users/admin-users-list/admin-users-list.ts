import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AdminUserResponse,
  AdminUsersService,
  AdminRolesService,
  RoleResponse,
} from '../../../../generated';

const PAGE_SIZE = 8;
// GET /api/admin/users is paged server-side, but there's no search param —
// same tradeoff as Suppliers: fetch a large page once and filter/paginate
// client-side against it.
const FETCH_SIZE = 500;

@Component({
  selector: 'app-admin-users-list',
  imports: [DatePipe],
  templateUrl: './admin-users-list.html',
  styleUrl: './admin-users-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersListComponent implements OnInit {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly adminRolesService = inject(AdminRolesService);

  // ---- Full dataset + client-side filter/paginate state ----
  private readonly allUsers = signal<AdminUserResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly page = signal(1); // 1-based, matches Suppliers/Warehouses

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.allUsers().filter((u) => {
      if (!this.showInactive() && !u.active) return false;
      if (term && !(u.fullName ?? '').toLowerCase().includes(term)) return false;
      return true;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly hasResults = computed(() => this.filtered().length > 0);
  readonly isFilteredEmpty = computed(() => this.filtered().length === 0 && this.allUsers().length > 0);
  readonly isTrulyEmpty = computed(() => this.allUsers().length === 0);

  readonly pageSummary = computed(() => {
    const total = this.filtered().length;
    if (total === 0) return '';
    const start = (this.currentPage() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage() * PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  // ---- Realm role catalog (for the assign-role picker) ----
  private readonly allRoles = signal<RoleResponse[]>([]);
  readonly rolesLoading = signal(false);
  readonly rolesError = signal<string | null>(null);

  // ---- Drawer state ----
  readonly drawerOpen = signal(false);
  readonly selectedId = signal<number | null>(null);

  // Detail is fetched separately from the list row because only
  // GET /api/admin/users/{id} does the live Keycloak call for realmRoles —
  // the list endpoint omits it to avoid one Keycloak round trip per row.
  readonly detail = signal<AdminUserResponse | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly toggling = signal(false);
  readonly resyncing = signal(false);

  readonly assignRoleName = signal('');
  readonly assigning = signal(false);
  readonly assignError = signal<string | null>(null);
  readonly revokingRole = signal<string | null>(null);

  readonly availableRolesToAssign = computed(() => {
    const assigned = new Set(this.detail()?.realmRoles ?? []);
    return this.allRoles().filter((r) => r.name && !assigned.has(r.name));
  });

  ngOnInit(): void {
    this.fetchUsers();
    this.fetchRoles();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  onShowInactiveChange(checked: boolean): void {
    this.showInactive.set(checked);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  // ---- Drawer ----------------------------------------------------------
  openUser(user: AdminUserResponse): void {
    if (user.id === undefined) return;
    this.selectedId.set(user.id);
    this.detail.set(null);
    this.detailError.set(null);
    this.assignRoleName.set('');
    this.assignError.set(null);
    this.drawerOpen.set(true);
    this.fetchDetail(user.id);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  deactivateLabel(): string {
    return this.detail()?.active ? 'Deactivate' : 'Activate';
  }

  toggleActive(): void {
    const current = this.detail();
    const id = this.selectedId();
    if (!current || id === null) return;

    this.toggling.set(true);
    const request$ = current.active
      ? this.adminUsersService.deactivateUser(id)
      : this.adminUsersService.activateUser(id);

    request$.subscribe({
      next: () => {
        this.toggling.set(false);
        this.fetchDetail(id);
        this.fetchUsers();
      },
      error: () => {
        this.toggling.set(false);
        this.detailError.set('Could not update status. Please try again.');
      },
    });
  }

  resync(): void {
    const id = this.selectedId();
    if (id === null) return;

    this.resyncing.set(true);
    this.detailError.set(null);
    this.adminUsersService.resyncUser(id).subscribe({
      next: (result) => {
        this.resyncing.set(false);
        this.detail.set(result);
        this.fetchUsers();
      },
      error: () => {
        this.resyncing.set(false);
        this.detailError.set('Could not resync this user from Keycloak. Please try again.');
      },
    });
  }

  onAssignRoleNameChange(value: string): void {
    this.assignRoleName.set(value);
  }

  assignRole(): void {
    const id = this.selectedId();
    const roleName = this.assignRoleName().trim();
    if (id === null) return;
    if (!roleName) {
      this.assignError.set('Choose a role to assign.');
      return;
    }

    this.assigning.set(true);
    this.assignError.set(null);
    this.adminUsersService.assignRole(id, { roleName }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignRoleName.set('');
        this.fetchDetail(id);
      },
      error: () => {
        this.assigning.set(false);
        this.assignError.set('Could not assign this role. Please try again.');
      },
    });
  }

  revokeRole(roleName: string): void {
    const id = this.selectedId();
    if (id === null) return;

    this.revokingRole.set(roleName);
    this.detailError.set(null);
    this.adminUsersService.revokeRole(id, roleName).subscribe({
      next: () => {
        this.revokingRole.set(null);
        this.fetchDetail(id);
      },
      error: () => {
        this.revokingRole.set(null);
        this.detailError.set(`Could not revoke ${roleName}. Please try again.`);
      },
    });
  }

  // ---- Data fetching ------------------------------------------------------
  private fetchUsers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    // active omitted (undefined) — fetch both active and inactive, then
    // filter client-side against showInactive, same as search.
    this.adminUsersService.listUsers(undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allUsers.set((result.content ?? []) as AdminUserResponse[]);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load users. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private fetchRoles(): void {
    this.rolesLoading.set(true);
    this.rolesError.set(null);
    this.adminRolesService.listRoles().subscribe({
      next: (result) => {
        this.allRoles.set(
          [...(result ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        );
        this.rolesLoading.set(false);
      },
      error: () => {
        this.rolesError.set('Could not load available roles.');
        this.rolesLoading.set(false);
      },
    });
  }

  private fetchDetail(userId: number): void {
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.adminUsersService.getUserDetail(userId).subscribe({
      next: (result) => {
        this.detail.set(result);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailError.set('Could not load this user. Please try again.');
        this.detailLoading.set(false);
      },
    });
  }
}

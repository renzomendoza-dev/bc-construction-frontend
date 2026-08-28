import { Injectable, signal } from '@angular/core';

const MOBILE_QUERY = '(max-width: 768px)';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  // Starts collapsed on phone-width screens, since the sidebar renders as a
  // full-height overlay there (see sidebar.scss) — opening on load would
  // otherwise cover the whole page before the user has done anything.
  readonly sidebarExpanded = signal(!window.matchMedia(MOBILE_QUERY).matches);

  toggleSidebar(): void {
    this.sidebarExpanded.update((v) => !v);
  }
}
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { Sidebar } from './core/layout/sidebar/sidebar';
import { Topbar } from './core/layout/topbar/topbar';
import { UserService } from './generated';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('bc-construction-frontend');

  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);

  constructor() {
    this.http.get(`${environment.apiBaseUrl}/actuator/health`).subscribe();

    // GET /api/users/me syncs this user's local profile (fullName, active,
    // etc.) from their Keycloak JWT on the backend — nothing else in the
    // app calls it, so without this a freshly-logged-in user may never get
    // a local User row created at all.
    this.userService.getCurrentUser().subscribe();
  }
}

import { Injectable, inject } from '@angular/core';
import Keycloak from 'keycloak-js';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly keycloak = inject(Keycloak);

  /** Keycloak username claim (login-required flow guarantees this is set before app renders). */
  get username(): string {
    return this.keycloak.tokenParsed?.['preferred_username'] ?? 'Unknown User';
  }

  /** Prefers the full display name claim; falls back to username if not set in Keycloak. */
  get fullName(): string {
    return this.keycloak.tokenParsed?.['name'] ?? this.username;
  }

  /** Realm roles from realm_access.roles — same claim your backend's KeycloakJwtAuthenticationConverter reads. */
  get roles(): string[] {
    return this.keycloak.tokenParsed?.['realm_access']?.['roles'] ?? [];
  }

  /**
   * Logs out of the Keycloak session and redirects back to the app root.
   * This clears the SSO session server-side too, not just local app state -
   * a fresh visit afterwards will require login again.
   */
  logout(): void {
    this.keycloak.logout({
      redirectUri: window.location.origin,
    });
  }
}
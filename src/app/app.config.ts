import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideKeycloak,
  createInterceptorCondition,
  IncludeBearerTokenCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  includeBearerTokenInterceptor,
} from 'keycloak-angular';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Only attach the JWT to requests going to our own backend — never to
// third-party origins if any get added later.
const bearerCondition: IncludeBearerTokenCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: new RegExp(`^${environment.apiBaseUrl}(/.*)?$`, 'i'),
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideKeycloak({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId,
      },
      initOptions: {
        // Every route requires an authenticated session — no anonymous
        // pages. Keycloak forces the login redirect before the app renders.
        onLoad: 'login-required',
        // pkceMethod defaults to 'S256' in recent keycloak-js — leave as-is
        // unless you have a reason to disable PKCE.
      },
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [bearerCondition],
    },
  ]
};

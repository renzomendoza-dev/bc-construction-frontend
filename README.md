# BC Construction Services — Frontend

Angular frontend for BC Construction Services' inventory, equipment, and admin operations, authenticated via Keycloak against the `bc-construction-backend` API. See [CHANGELOG.md](./CHANGELOG.md) for a running history of changes.

## Features

- **Dashboard** — module overview cards with live inventory stats.
- **Inventory**
  - Items — list, detail (view/edit toggle), create, images, linked suppliers, categories.
  - Suppliers — list with create/edit drawer.
  - Warehouses & Sites — list/create, `MAIN`/`SITE` type, storage locations.
  - Purchase Receipts — draft → confirm workflow that applies stock on confirmation.
  - Stock Levels — grouped-by-item view with Low Stock and Movement History tabs, per-row Adjust/Transfer actions, inline reorder-threshold editing.
  - Transfers — batched stock transfers between a warehouse and a site (pull-out or dispatch), draft → submit workflow.
  - Material Requests — a site's request for materials, with edit-in-place support and a shortcut to create a fulfilling dispatch transfer.
- **Equipment** — list, checkout/checkin, create/edit.
- **Admin** — user list with activate/deactivate and Keycloak realm-role assignment.
- **Access control** — mutating UI actions are gated behind fine-grained permissions read from the authenticated user's Keycloak JWT.
- Responsive layout (collapsible/overlay sidebar, scrollable tables, stacked forms on narrow screens).

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

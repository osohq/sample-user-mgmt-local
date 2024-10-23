# Oso Cloud document sharing example application

This application provides a reference for using Oso Cloud's [local
authorization](https://www.osohq.com/docs/reference/authorization-data/local-authorization)
to create a multi-tenant document sharing application with a microservice
architecture.

## App UX

The application includes a multi-tenant-enabled user management system, which
lets you create organizations (tenants), as well as users within those tenants
with specific roles. When running the app, you have a super-admin like
impersonation privilege that lets you view the application state as any given
user.

Users can create documents, which they can then share with other users,
assigning them specific roles on the shared files. The only editable field of
the documents are their titles, though other capabilities are more
full-featured.

## Technologies

- Oso Cloud w/ both
  [centralized](https://www.osohq.com/docs/authorization-data/centralized) and
  [local
  authorization](https://www.osohq.com/docs/reference/authorization-data/local-authorization)
- Docker Compose
- Next.js with React server components for the backend
- PostgreSQL

## Reference files

The project contains many reference files, which provide realistic examples of
how to accomplish complex tasks in your own application.

| File                  | Description                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oso_policy.polar`    | A complex policy demonstrating RBAC, ReBAC, and ABAC                                                                                                                                                 |
| `oso_local_auth*.yml` | Per-serivce [local auth configuration](https://www.osohq.com/docs/authorization-data/local-authorization#config)                                                                                     |
| `actions/*.ts`        | [Node.js SDK](https://www.osohq.com/docs/app-integration/client-apis/node) authorization enforcement w/ React server components. For more details, see [Enforcement patterns](#enforcement-patterns) |
| `app/**/*.tsx`        | React frontend integrating with authorization-oriented backend                                                                                                                                       |
| `lib/oso.ts`          | Oso client generation/config                                                                                                                                                                         |

### Enforcement patterns

Different components offer different examples of authorization patterns:

| Component                      | File                                      | Pattern                                                                             |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `Organization`s (tenants)      | `/actions/org.ts`                         | RBAC: [multi-tenancy], [global roles]                                               |
| `Users` within `Organization`s | `/actions/user.ts`                        | ReBAC: [user-resource relations]                                                    |
| `Document`s                    | `/actions/doc.ts`, `actions/doc_perms.ts` | RBAC: [resource roles], ReBAC: [user-resource relations], ABAC: [private resources] |

[global roles]: https://www.osohq.com/docs/guides/role-based-access-control-rbac/globalroles
[multi-tenancy]: https://www.osohq.com/docs/guides/role-based-access-control-rbac/roles
[private resources]: https://www.osohq.com/docs/guides/attribute-based-access-control-abac/public
[resource roles]: https://www.osohq.com/docs/guides/role-based-access-control-rbac/resourcespecific
[user-resource relations]: https://www.osohq.com/docs/guides/relationship-based-access-control-rebac/ownership

### Centralized authz data reconciliation

To manage authorization data, Oso offers a service to [sync data to Oso's
centralized authorization
data](https://www.osohq.com/docs/authorization-data/centralized/manage-centralized-authz-data/sync-data#sync-facts-in-production).
However, the syncing service is only available to [customers at the Growth tier
or above](https://www.osohq.com/pricing).

We've included details for using the sync service for documentation purposes,
but commented out places where it would run.

- `env_template_oso_sync.yml`
- `Dockerfile.oso_reconcile`
- `docker-compose.yml`

## App architecture

The physical application that gets built via Docker compose is:

- Next.js with React server components for the backend
- PostgreSQL

The React server components that constitute the backend authorize requests using
Oso Cloud using [local
authorization](https://www.osohq.com/docs/reference/authorization-data/local-authorization).

However, the **logical** application that gets built mimics a microservice
architecture, primarily enforced by creating distinct databases for each
service. In the case of this application, the two services are:

- User management, which creates organizations and users
- Documents, which lets users create and share documents

The backend, though physically unified, behaves as if it is not and uses
separate clients to connect to both the PG database and Oso Cloud.

In this diagram, the lines connecting the backend services represent distinct
clients.

```
                 next.js
 ┌────────────────┬───────────────────┐
 │    frontend    │       backend     │      PG DB
 │                │┌─────────┐        │   ┌─────────┐
 │                ││         │        │   │         │
 │                ││  /users ┼────────┼───►   Users │
 │                │└──▲──────┘        │   ├─────────┤
 │                │   │┌─────────┐    │   │         │
 │                │   ││         │    │ ┌─►    Docs │
 │                │   ││   /docs ┼────┼─┘ └─────────┘
 │                │   │└────────▲┘    │
 └────────────────┴───┼─────────┼─────┘
                      │         │
                     ┌▼─────────▼──┐
                     │             │
                     │  Oso Cloud  │
                     │             │
                     │             │
                     └─────────────┘
```

### Microservices + local authorization

With a microservice architecture like the one laid out above, services do not
have access to each others' data. This means that even though authorization
decisions made in many services will depend on the `/users` service, they cannot
access it directly.

To handle this complexity, Oso offers [centralized authorization
data](https://www.osohq.com/docs/authorization-data/centralized). In this
application, it means that as the `/users` service performs CRUD operations on
its database, it also needs to propagate those changes to Oso Cloud. This way,
when the `/docs` service needs to enforce authorization, it can do so with the
copy of the `/users` data that Oso Cloud has.

Further, because Oso's local authorization considers centralized authorization
data when generating SQL expressions, the `/docs` service can still use local
authorization.

## Running the app

1. [Log in to or create an Oso Cloud account](https://ui.osohq.com/).
1. [Create an API key for the
   application](https://www.osohq.com/docs/guides/production/manage-organization-settings#create-new-api-keys).
   Make sure you save this!
1. Copy `/oso-policy.polar` as the policy in the environment by deploying it.
1. Convert `.env.example` to `.env` with the appropriate values set, e.g.
   `OSO_CLOUD_API_KEY`.
1. Install the dependencies using a Node.JS package manager, such as `npm` or
   `yarn`.
1. Run the app locally via:

   ```sh
   docker compose up --build
   ```

   Note the provided `docker-compose.yml` file makes the PostgreSQL container
   accessible from the host machine on port `5433`. This should reduce the
   likelihood of interfering with any local PostgresSQL instances. Within Docker
   compose network, it still runs on the standard port, `5432`.

   If that port fails to work, grep for it in the provided code and change it to
   any other value.

1. Load the app at `http://localhost:3000`

From here you can create and manage:

- `Organization`s
- `User`s
- `Document`s

## Demonstrating the app

The application is meant to provided a means of creating tenants (Organizations)
and users, and then letting users create a and share documents with one another.

Going through these steps will demonstrate to you a number of its features.

1. Go to <http://localhost:3000/user/root>.
1. In **Create orgs**, enter `acme` and click **Add org**. You can now create
   users in a separate tenant.
1. In **Create users**, create a user named `alice` in the `acme` organization
   with the `admin` role, and then click **Add user**.
1. Click the link for `alice`, or go to <http://localhost:3000/user/alice>.
1. Because `alice` is an admin, you will be able to create other users in the
   `acme` organization here. Do that, creating a user `bob` who is a `member`.
1. In the **alice Docs** section, click **Create doc**, and name it `private`.
1. On the page that loads (which should be
   <http://localhost:3000/user/root/docs/1>), in the **Shareable** section, make
   `bob` and `editor`.
1. Click `< Home` in the upper-left-hand corner, and then create another
   document called `public`.
1. On the page that loads (which should be
   <http://localhost:3000/user/root/docs/2>), click **Set public**.
1. Click `< Home` and then click the [`bob`](http://localhost:3000/user/bob)
   link.
1. In the **bob Docs** section, you should see the following docs:
   - `private` because `alice` explicitly shared the document with `bob`. If you
     visit the document, you can change its title, which will be visible to all
     users who can see it.
   - `public` because `alice` and `bob` are both members of the same
     organization (`acme`) and the doc is public.

To understand why and how this all works, you'll need to read the code!

## Notes + TODOs

### Styling

TODO: Add a style to the app. Currently, the GUI is entirely unstyled HTML.

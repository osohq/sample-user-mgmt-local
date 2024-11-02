# Oso Cloud customer relationship manager (CRM) example application

This application provides a reference for using Oso Cloud's [local
authorization](https://www.osohq.com/docs/reference/authorization-data/local-authorization)
to create a multi-tenant customer relationship manager (CRM) application with a
microservice architecture.

## App UX

The application includes a multi-tenant-enabled user management system, which
lets you create organizations (tenants), as well as users within those tenants
with specific roles. When running the app, you have a super-admin like
impersonation privilege that lets you view the application state as any given
user.

### CRM model

The main purpose of the application is to demonstrate Oso's ability to handle
customer relationship managers, akin to Salesforce.

#### Objects

The CRM application focuses on two objects:

- Opportunities, which are potential business contracts
- Territories, which can be assigned to users and can have opportunities
  assigned to them

#### Roles

Customer relationship managers are very complex, which the application model
mirrors. To help develop a sense of what the application does, we'll focus on
which roles a user can have on an organization and what that entitles them to
do.

##### `admin`

`admin`s are super users which can create new users and assign top-level
territories.

In this application, only the `root` user in the `_root` organization can also
create more organizations/tenants.

##### `analyst`

Analysts have the ability to see the amount of all opportunities throughout the
organization.

##### `deal_desk`

If an opportunity is in the **negotiating** stage, it can be assigned to a
`deal_desk` member. Once it's assigned, the user has the ability to view and
change the opportunity's details––namely its amount and status.

##### `sales`

`sales` users represent the most complex interactions in the application.

`sales` users can:

- Assign other `sales` users responsibility for their sub-territories. If the
  user is responsible for `USA`, they can also assign the same responsibility to
  other `sales` users.
- Create new opportunities in any territory that they're responsible for.
- Assign other `sales` users to opportunities in territories they're responsible
  for.
- Assign `deal_desk` users to opportunities in the **negotiating** stage.
- Change the stage and amount of opportunities to which they're assigned.
  Mangers of the assignee may also change these values.
- View the amounts of any opportunities in territories for which they're
  responsible.

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
| `oso_policy.polar`    | A complex policy demonstrating RBAC, ReBAC, ABAC, and field-level access                                                                                                                             |
| `oso_local_auth*.yml` | Per-serivce [local auth configuration](https://www.osohq.com/docs/authorization-data/local-authorization#config)                                                                                     |
| `actions/*.ts`        | [Node.js SDK](https://www.osohq.com/docs/app-integration/client-apis/node) authorization enforcement w/ React server components. For more details, see [Enforcement patterns](#enforcement-patterns) |
| `app/**/*.tsx`        | React frontend integrating with authorization-oriented backend                                                                                                                                       |
| `lib/oso.ts`          | Oso client generation/config                                                                                                                                                                         |

### Enforcement patterns

Different components offer different examples of authorization patterns:

| Component                    | File               | Pattern                                                                 |
| ---------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `Organization` (tenants)     | `/actions/org.ts`  | RBAC: [multi-tenancy], [global roles]                                   |
| `User` within `Organization` | `/actions/user.ts` | ReBAC: [user-resource relations], [recursive]                           |
| `Territory`                  | `/actions/crm.ts`  | RBAC: [resource roles], ReBAC: [recursive]                              |
| `Opportunity`                | `/actions/crm.ts`  | RBAC: [resource roles], ReBAC: [user-resource relations], [Field-level] |

[global roles]: https://www.osohq.com/docs/guides/role-based-access-control-rbac/globalroles
[multi-tenancy]: https://www.osohq.com/docs/guides/role-based-access-control-rbac/roles
[private resources]: https://www.osohq.com/docs/guides/attribute-based-access-control-abac/public
[resource roles]: https://www.osohq.com/docs/guides/role-based-access-control-rbac/resourcespecific
[user-resource relations]: https://www.osohq.com/docs/guides/relationship-based-access-control-rebac/ownership
[Field-level]: https://www.osohq.com/docs/modeling-in-polar/field-level-authorization/fields-in-permissions
[recursive]: https://www.osohq.com/docs/modeling-in-polar/relationship-based-access-control-rebac/orgcharts#implement-the-logic

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
- CRM, which lets users manage opportunities and territories

The backend, though physically unified, behaves as if it is not and uses
separate clients to connect to both the PG database and Oso Cloud.

In this diagram, the lines connecting the backend services represent distinct
clients.

```
                 next.js
 ┌────────────────┬───────────────────┐
 │    frontend    │       backend     │      PG DB
 │                │┌─────────┐        │   ┌─────────┐
 │                ││  /users ┼────────┼───►   Users │
 │                │└──▲──────┘        │   │         │
 │                │   │┌─────────┐    │   ├─────────┤
 │                │   ││    /crm ┼────┼───►     CRM │
 │                │   │└────────▲┘    │   └─────────┘
 └────────────────┴───┼─────────┼─────┘
                      │         │
                     ┌▼─────────▼──┐
                     │  Oso Cloud  │
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
when the `/crm` service needs to enforce authorization, it can do so with the
copy of the `/users` data that Oso Cloud has.

Further, because Oso's local authorization considers centralized authorization
data when generating SQL expressions, the `/crm` service can still use local
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

- `Organization`
- `User`
- `Opportunity`
- `Territory`

Here is an example set of tasks:

- Using `root`, create a new organization.
- Create a new `admin` user in that organization.
- Switch to the new admin user, and create a new `sales` user. Imagine this is
  your head of sales.
- Go to the **Territories** tab and assign the new `sales` user responsibility
  for `USA`.
- Create another new **sales** user with the head of sales as their manager.
  Imagine this is a regional VP. Repeat this process two more times.
- Create a new **deal_desk** user.
- Create a new **analyst** user.
- Switch to the head of sales. Go to the **Territories** tab and assign regional
  territories to your new users.
- Switch to one of the regional VPs and create some deals in their regions,
  assigning them to the regional VP and filling out their totals. Move some of
  the deals into the **closed-won** stage.

  Repeat this process for the other regional VPs.

  As you'll see, the regional VPs' sales reports only update for the regions
  they're responsible for. For example, you should not see the report totaled
  for the _USA_ region.

- For one of the deals that is not **closed-won** yet, move it to the
  **negotiating** stage. Then assign it to the **deal_desk** user.
- Switch to the **deal_desk** user. The opportunity shows up as editable for the
  user. Modify its value and change its status to **closed-won**. This should
  then update the sales report to show for this user.
- Switch to the **analyst** user. The sales report should show all of the
  regions' reports.
- Switch back to the head of sales user, which should have the same report as
  the **analyst**.

## Notes + TODOs

### Styling

TODO: Add a style to the app. Currently, the GUI is entirely unstyled HTML.

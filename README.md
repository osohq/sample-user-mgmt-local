This code provides a base from which other sample apps should be built.
Primarily, this code includes a NextJs app w/ a PostgreSQL backend, orchestrated
through Docker compose.

Feature-wise, this code provides a "boilerplate" multi-tenant user management
system, which allows:

- Creating new tenants (`Organization`s)
- Creating and deleting users in those tenants
- Assigning users' roles within a tenant
- "Impersonating" a user to view the app as the specified user

Additional apps should retain this feature––either displaying it alongside the
details of the new app, or allowing users to toggle it open via tabs.

# Documentation + Examples

This app's primary purposes are providing reference and documentation for using
Oso's local authorization.

While any part of the code might be instructive, the primary set of
documentation is includes in the "backend" API implementation, found in various
TypeScript files located in `/actions`.

This code currently uses React server components for the API. Even if you do not
use React server components in your application, the examples are easily
adaptable to any API structure––all of the patterns are amenable to any endpoint
implementation.

# User management "component"

This application provides a user management system from which other sample apps
can be built––e.g. file sharing application––including a GUI.

This is necessary to do first because all other sample apps will be simpler to
demo if you're able to easily see the impact that authorization has on different
users' access to resources. For instance, if you share a file with another user,
it's powerful to demonstrate that user can now access the file with the
permissions you identified.

## Architecture

- NextJS with app routers for the back end
  - Automatic reload on changes
- PostgreSQL
  - Initialized with `db_init_template.sql`, which can reference `.env`
    variables.
- Docker w/ compose to build and run both components

## Oso integration

- Uses local auth exclusively

## Expected UX

1. Add `/oso-policy.polar` as the policy in the environment.
1. Convert `.env.example` to `.env` with the appropriate values set, i.e. adding
   your API key.
1. Run the app locally via:
   ```sh
   docker compose up --build
   ```
1. Load the app at `http://localhost:3000`
1. Click the user you want to impersonate.
1. If the users has the requisite permissions you can:

   - Add users
   - Change users' roles
   - Delete users
   - Add new organizations

   Users without any of these features (i.e. `member`s), will just have their
   information displayed. The white space here will be filled with the user's
   view of the application with which this is integrated, e.g. their files and
   folders.

   You can also click the links of any users that you can manage to view the
   application as they would, i.e. impersonation.

## Notes + TODOs

### Coding style

Code in this repo + derived sample apps should be semantically thorough, but a
lack of polish is totally acceptable.

The distinction here is that we must be sure that our recommendations are viable
in the context of a modern web app. I find it incredibly frustrating when a
reference app doesn't deal with any the complexities of producing _actual_
software, and the lack of consideration means that the examples provided are all
but useless when I am trying to do something.

While this does mean that the apps might take longer to build, they're much
higher quality and give us many more opportunities to develop empathy with users
who are trying to use Oso to produce _very_ expensive applications.

### global permissions

Currently `global` rules have an impedance mismatch with local authorization,
i.e. local authorization cannot authorize users' access to `global` rules. This
will be fixed once local authorization adopts the query builder API.

### Styling

TODO: Add a style to the app. Currently, the GUI is entirely unstyled HTML.

I left all of the `tailwind` boilerplate in here because it seemed obnoxious to
remove it and try to re-add it.

### Contrived roles

The policy is a bit over-engineered, e.g. editing and deleting users is split
across separate permissions, even though there are currently no roles that can
do one but not the other.

### Posting policy

TODO: When building, I would like to post the policy to Oso Cloud, so that
`oso-policy.polar` locally is the authoritative source of truth.

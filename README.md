# Examples

- `app/user/[username]/page.tsx` demonstrates using local authorization for list
  filtering, i.e. returning subsets of data from your database based on the
  policy retained in Oso.

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

## Component features

- Create organizations
- Create + delete users in organizations
- Mange users' roles (`admin`, `member`)
- View state as user

## Oso integration

- Uses local auth exclusively

## Expected UX

1. Convert `.env.example` to `.env` with the appropriate values set.
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

### global roles

Currently `global` roles have an impedance mismatch with local authorization and
many standard rules one might want to write are verboten. To work around this,
I've added a bootstrapped global organization `_`. This requires hacks in a few
places that are not great, but figured it was better to make progress with this
than wait for https://github.com/osohq/oso-service/pull/3127

### Styling

TODO: Add a style to the app. Currently, the GUI is entirely unstyled HTML.

I left all of the `tailwind` boilerplate in here because it seemed obnoxious to
remove it and try to re-add it.

### Contrived roles

The policy is a bit over-engineered, e.g. editing and deleting users is split
across separate permissions, even though there are currently no roles that can
do one but not the other.

I think this is fine for the base because other applications might introduce
uses for the distinction there.

### Posting policy

TODO: When building, I would like to post the policy to Oso Cloud, so that
`oso-policy.polar` locally is the authoritative source of truth.

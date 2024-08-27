import { Oso } from "oso-cloud";

const key = process.env.OSO_CLOUD_API_KEY;
if (!key) {
  throw new Error(`OSO_CLOUD_API_KEY not set in .env`);
}

export const oso = new Oso("https://cloud.osohq.com", key, {
  dataBindings: "/app/oso-local-auth.yaml",
});

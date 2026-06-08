import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  console.log(
    "url present:",
    !!url,
    "| key prefix:",
    key?.slice(0, 11),
    "| key length:",
    key?.length,
  );

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.log("ADMIN ERROR:", JSON.stringify(error, null, 2));
  } else {
    console.log("ADMIN OK — listUsers returned", data.users.length, "user(s)");
  }
  process.exit(0);
}
main().catch((e) => {
  console.error("THREW:", e);
  process.exit(1);
});

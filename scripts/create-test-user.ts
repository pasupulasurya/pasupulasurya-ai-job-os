import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error("usage: tsx scripts/create-test-user.ts <email> <password>");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }

  console.log(`Created confirmed user: ${email}`);
  console.log(`  auth id: ${data.user?.id}`);
  console.log(`  log in at /login with this email + the password you set`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

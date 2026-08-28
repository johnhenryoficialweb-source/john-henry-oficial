/**
 * Restablece la contraseña de un usuario staff existente en Supabase Auth.
 *
 * Uso: npx tsx scripts/reset-staff-password.ts correo@dominio.com
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(18);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: npx tsx scripts/reset-staff-password.ts correo@dominio.com");
    process.exit(1);
  }

  loadEnv();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const password = generatePassword();

  const { data: staff } = await admin
    .from("staff_users")
    .select("id, full_name, email, role")
    .ilike("email", email)
    .maybeSingle();

  if (!staff) throw new Error(`No hay staff con correo ${email}.`);

  const { error } = await admin.auth.admin.updateUserById(staff.id, { password });
  if (error) throw new Error(error.message);

  console.log("Contraseña restablecida:");
  console.log(`  Nombre:  ${staff.full_name}`);
  console.log(`  Correo:  ${staff.email}`);
  console.log(`  Rol:     ${staff.role}`);
  console.log(`  Clave:   ${password}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

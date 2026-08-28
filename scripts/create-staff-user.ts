/**
 * Crea un usuario del staff directamente (sin invitación por correo):
 * auth.users con contraseña generada + fila en staff_users.
 *
 * Uso:
 *   npx tsx scripts/create-staff-user.ts "Nombre Completo" correo@dominio.com admin
 *
 * Imprime la contraseña generada una sola vez — entrégala por un canal seguro.
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
  // 18 chars alfanuméricos + símbolos seguros, sin ambiguos (0/O, 1/l/I).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(18);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  const [fullName, email, role] = process.argv.slice(2);
  if (!fullName || !email || !role) {
    console.error('Uso: npx tsx scripts/create-staff-user.ts "Nombre" correo admin|staff [locationCode]');
    process.exit(1);
  }
  const locationCode = process.argv[5] ?? null;

  loadEnv();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const password = generatePassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "No se pudo crear el usuario en auth.");
  }

  let locationId: string | null = null;
  if (locationCode) {
    const { data: location } = await admin
      .from("locations")
      .select("id")
      .eq("code", locationCode)
      .single();
    locationId = location?.id ?? null;
  }

  const { error: insertError } = await admin.from("staff_users").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role,
    location_id: locationId,
  });
  if (insertError) throw new Error(insertError.message);

  console.log("Usuario creado:");
  console.log(`  Nombre:  ${fullName}`);
  console.log(`  Correo:  ${email}`);
  console.log(`  Rol:     ${role}`);
  console.log(`  Clave:   ${password}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

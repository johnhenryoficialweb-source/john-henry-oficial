"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2Icon } from "lucide-react";
import { Imagotipo } from "@/components/brand/logo";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Imagotipo size="sm" />
          <h1 className="mt-10 font-display text-2xl font-light tracking-wide">Panel interno</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acceso para el equipo.</p>
        </div>
        {children ?? (
          <Card>
            <CardContent className="flex justify-center py-10">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") !== "staff") return;
    const supabase = createClient();
    void supabase.auth.signOut().then(() => {
      toast.error("Sin acceso al panel", {
        description: "Tu cuenta no está autorizada como staff. Contacta a un administrador.",
      });
      router.replace("/login");
    });
  }, [searchParams, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("No se pudo iniciar sesión", { description: "Verifica tu correo y contraseña." });
      setIsSubmitting(false);
      return;
    }

    const { data: staffUser } = await supabase
      .from("staff_users")
      .select("id, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!staffUser?.is_active) {
      await supabase.auth.signOut();
      toast.error("Sin acceso al panel", {
        description: "Tu cuenta no está autorizada como staff. Contacta a un administrador.",
      });
      setIsSubmitting(false);
      return;
    }

    toast.success("Sesión iniciada");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <LoginShell>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@johnhenryoficial.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </LoginShell>
  );
}

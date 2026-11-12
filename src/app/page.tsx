import { userClient } from "@/lib/supabase/server";
import { Workspace } from "@/components/workspace";
import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return (
      <main className="setup-screen">
        <h1>Let’s connect your workspace.</h1>
        <p>
          Start OrbStack, then run <code>pnpm db:start</code> and{" "}
          <code>pnpm db:setup</code>. Restart the dev server after setup.
        </p>
      </main>
    );
  const client = await userClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? (
    <Workspace email={user.email ?? "Your account"} />
  ) : (
    <AuthForm />
  );
}

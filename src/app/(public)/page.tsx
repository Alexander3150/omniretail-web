import { Button } from "@/shared/components/Button";

export default function PublicHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6">
      <section className="w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
        <h1 className="mt-3 text-4xl font-bold text-[var(--color-title)]">Frontend Base</h1>
        <div className="mt-8 flex justify-center">
          <Button href="/inicio">Iniciar sesion</Button>
        </div>
      </section>
    </main>
  );
}

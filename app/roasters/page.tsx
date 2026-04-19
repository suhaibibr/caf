import { ManagedRoastersGrid } from "@/components/ManagedRoastersGrid";
import { NavBar } from "@/components/NavBar";
import { listRoasters } from "@/lib/roasters-db";

export const revalidate = 60;

export default async function RoastersPage() {
  const roasters = await listRoasters();

  return (
    <main className="theme-page page-shell min-h-screen px-8 pt-28 pb-16 sm:px-12">
      <NavBar tone="dark" />
      <section className="mx-auto max-w-6xl">
        <ManagedRoastersGrid initialRoasters={roasters} />
      </section>
    </main>
  );
}

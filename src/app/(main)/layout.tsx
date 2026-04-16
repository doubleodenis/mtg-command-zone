import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/features/navbar";
import { TabNav } from "@/components/layout";
import { AUTHENTICATED_NAV, PUBLIC_NAV } from "@/lib/nav-config";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const navItems = user ? AUTHENTICATED_NAV : PUBLIC_NAV;

  return (
    <>
      <Navbar />
      <TabNav items={navItems} />
      <main className="max-w-6xl md:min-w-4xl px-4 py-8 md:mx-auto">
        {children}
      </main>
    </>
  );
}

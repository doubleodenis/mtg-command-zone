import { Navbar } from "@/components/features/navbar";
import { TabNav } from "@/components/layout";
import { AUTHENTICATED_NAV } from "@/lib/nav-config";

export default function MatchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <TabNav items={AUTHENTICATED_NAV} />
      <main className="max-w-6xl px-4 py-8">
        {children}
      </main>
    </>
  );
}

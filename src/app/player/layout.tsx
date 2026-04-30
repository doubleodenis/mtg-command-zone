import { Navbar } from "@/components/features/navbar";
import { AUTHENTICATED_NAV } from "@/lib/nav-config";
import { TabNav } from "@/components/layout";

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <TabNav items={AUTHENTICATED_NAV} />
      <main className="max-w-6xl md:w-full md:mx-auto px-4 py-8">
        {children}
      </main>
    </>
  );
}

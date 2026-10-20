import { Navbar } from "@/components/features/navbar";
import { TabNav } from "@/components/layout";
import { AUTHENTICATED_NAV } from "@/lib/nav-config";

export default function MatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <TabNav items={AUTHENTICATED_NAV} />
      {children}
    </>
  );
}

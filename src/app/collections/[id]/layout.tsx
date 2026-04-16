import { TabNav, type NavItem } from "@/components/layout";

interface CollectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function CollectionLayout({
  children,
  params,
}: CollectionLayoutProps) {
  const { id } = await params;

  const navItems: NavItem[] = [
    { label: "Overview", href: `/collections/${id}` },
    { label: "Matches", href: `/collections/${id}/matches` },
    { label: "Leaderboard", href: `/collections/${id}/leaderboard` },
    { label: "Members", href: `/collections/${id}/members` },
    { label: "Settings", href: `/collections/${id}/settings` },
  ];

  return (
    <>
      <TabNav items={navItems} />
      <main className="max-w-6xl md:min-w-2xl md:mx-auto px-4 py-8">
        {children}
      </main>
    </>
  );
}

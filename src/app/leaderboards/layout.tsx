import { Navbar } from "@/components/features/navbar";

export default function LeaderboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

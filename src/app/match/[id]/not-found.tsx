import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/features/navbar'

export default function MatchNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Match Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-text-3">
              The match you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/matches">
                <Button variant="secondary">View All Matches</Button>
              </Link>
              <Link href="/">
                <Button>Go Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

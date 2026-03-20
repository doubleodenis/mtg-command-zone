"use client";

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Avatar,
  FormatBadge,
  BracketIndicator,
  BracketBadge,
  RatingDelta,
  RatingDisplay,
  ConfirmationStatus,
  ConfirmationCount,
  WLBadge,
  ManaPip,
  ColorIdentity,
} from "@/components/ui";
import type { FormatSlug } from "@/types/format";
import type { ManaColor } from "@/app/_design-system";
import type { Bracket } from "@/components/ui/bracket-indicator";

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-bg-base p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <header>
          <h1 className="text-elo text-text-1 mb-2">Design System</h1>
          <p className="text-text-2 text-lg">CommandZone UI component library</p>
        </header>

        {/* Buttons */}
        <Section title="Button">
          <div className="space-y-4">
            <Row label="Variants">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">⚡</Button>
            </Row>
            <Row label="States">
              <Button disabled>Disabled</Button>
            </Row>
          </div>
        </Section>

        {/* Input */}
        <Section title="Input">
          <div className="max-w-sm space-y-3">
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
            <Input type="password" placeholder="Password input" />
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description text goes here</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-text-2">Card content with some example text.</p>
              </CardContent>
            </Card>
            <Card className="border-accent-ring">
              <CardHeader>
                <CardTitle>Accent Border</CardTitle>
                <CardDescription>Card with accent border highlight</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <RatingDisplay rating={1847} delta={18} />
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Badge */}
        <Section title="Badge">
          <Row label="Variants">
            <Badge>Default</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="win">Win</Badge>
            <Badge variant="loss">Loss</Badge>
            <Badge variant="gold">Gold</Badge>
            <Badge variant="outline">Outline</Badge>
          </Row>
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <Row label="Sizes">
            <Avatar size="xs" fallback="XS" />
            <Avatar size="sm" fallback="SM" />
            <Avatar size="md" fallback="MD" />
            <Avatar size="lg" fallback="LG" />
            <Avatar size="xl" fallback="XL" />
          </Row>
          <Row label="With image">
            <Avatar
              size="lg"
              src="https://api.dicebear.com/7.x/identicon/svg?seed=player1"
              alt="Player 1"
            />
            <Avatar
              size="lg"
              src="https://api.dicebear.com/7.x/identicon/svg?seed=player2"
              alt="Player 2"
            />
          </Row>
        </Section>

        {/* Format Badge */}
        <Section title="Format Badge">
          <Row label="All formats">
            {(["1v1", "2v2", "3v3", "ffa", "pentagram"] as FormatSlug[]).map((format) => (
              <FormatBadge key={format} format={format} />
            ))}
          </Row>
        </Section>

        {/* Bracket Indicator */}
        <Section title="Bracket Indicator">
          <Row label="Visual indicator">
            {([1, 2, 3, 4] as Bracket[]).map((bracket) => (
              <div key={bracket} className="flex items-center gap-2">
                <BracketIndicator bracket={bracket} />
                <span className="text-mono-xs text-text-2">B{bracket}</span>
              </div>
            ))}
          </Row>
          <Row label="Compact badge">
            {([1, 2, 3, 4] as Bracket[]).map((bracket) => (
              <BracketBadge key={bracket} bracket={bracket} />
            ))}
          </Row>
          <Row label="Small size">
            {([1, 2, 3, 4] as Bracket[]).map((bracket) => (
              <BracketIndicator key={bracket} bracket={bracket} size="sm" />
            ))}
          </Row>
        </Section>

        {/* Rating Delta */}
        <Section title="Rating Delta">
          <Row label="Positive / Negative / Zero">
            <RatingDelta delta={18} />
            <RatingDelta delta={-12} />
            <RatingDelta delta={0} />
          </Row>
          <Row label="Sizes">
            <RatingDelta delta={24} size="sm" />
            <RatingDelta delta={24} size="md" />
            <RatingDelta delta={24} size="lg" />
          </Row>
        </Section>

        {/* Rating Display */}
        <Section title="Rating Display">
          <div className="space-y-4">
            <Row label="With delta">
              <RatingDisplay rating={1847} delta={18} size="lg" />
            </Row>
            <Row label="Hero size">
              <RatingDisplay rating={1847} size="hero" />
            </Row>
            <Row label="All sizes">
              <RatingDisplay rating={1234} size="sm" />
              <RatingDisplay rating={1234} size="md" />
              <RatingDisplay rating={1234} size="lg" />
            </Row>
          </div>
        </Section>

        {/* Confirmation Status */}
        <Section title="Confirmation Status">
          <Row label="States">
            <ConfirmationStatus status="confirmed" showLabel />
            <ConfirmationStatus status="pending" showLabel />
            <ConfirmationStatus status="unconfirmed" showLabel />
          </Row>
          <Row label="Dot only">
            <ConfirmationStatus status="confirmed" />
            <ConfirmationStatus status="pending" />
            <ConfirmationStatus status="unconfirmed" />
          </Row>
          <Row label="Count">
            <ConfirmationCount confirmed={4} total={4} />
            <ConfirmationCount confirmed={2} total={4} />
            <ConfirmationCount confirmed={0} total={4} />
          </Row>
        </Section>

        {/* WL Badge */}
        <Section title="Win/Loss Badge">
          <Row label="Results">
            <WLBadge result="win" />
            <WLBadge result="loss" />
          </Row>
        </Section>

        {/* Mana Pip */}
        <Section title="Mana Pip & Color Identity">
          <Row label="Individual pips">
            {(["W", "U", "B", "R", "G"] as ManaColor[]).map((color) => (
              <ManaPip key={color} color={color} />
            ))}
          </Row>
          <Row label="Small pips">
            {(["W", "U", "B", "R", "G"] as ManaColor[]).map((color) => (
              <ManaPip key={color} color={color} size="sm" />
            ))}
          </Row>
          <Row label="Color identities">
            <ColorIdentity colors={["W", "U"]} />
            <ColorIdentity colors={["B", "R"]} />
            <ColorIdentity colors={["G"]} />
            <ColorIdentity colors={["W", "U", "B", "R", "G"]} />
            <ColorIdentity colors={[]} />
          </Row>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-4">
            <div>
              <span className="text-label text-text-2 block mb-1">ELO HERO</span>
              <span className="text-elo text-text-1">1847</span>
            </div>
            <div>
              <span className="text-label text-text-2 block mb-1">STAT VALUE</span>
              <span className="text-stat text-text-1">67.4%</span>
            </div>
            <div>
              <span className="text-label text-text-2 block mb-1">DELTA</span>
              <span className="text-delta text-win">+18</span>
            </div>
            <div>
              <span className="text-sublabel text-text-2 block mb-1">SUBLABEL</span>
              <span className="text-mono-xs text-text-2">1829 → 1847</span>
            </div>
            <div>
              <span className="text-label text-text-2 block mb-1">UI TEXT</span>
              <span className="text-ui text-text-1">Navigation Item</span>
            </div>
            <div>
              <span className="text-label text-text-2 block mb-1">WORDMARK</span>
              <span className="text-wordmark text-text-1">CommandZone</span>
            </div>
          </div>
        </Section>

        {/* Colors */}
        <Section title="Colors">
          <div className="space-y-4">
            <Row label="Backgrounds">
              <Swatch className="bg-bg-base" label="base" />
              <Swatch className="bg-bg-surface" label="surface" />
              <Swatch className="bg-bg-raised" label="raised" />
              <Swatch className="bg-bg-overlay" label="overlay" />
            </Row>
            <Row label="Card">
              <Swatch className="bg-card" label="card" />
              <Swatch className="bg-card-raised" label="raised" />
            </Row>
            <Row label="Accent">
              <Swatch className="bg-accent" label="accent" />
              <Swatch className="bg-accent-fill" label="fill" />
              <Swatch className="bg-accent-dim" label="dim" />
            </Row>
            <Row label="Text">
              <Swatch className="bg-text-1" label="text-1" dark />
              <Swatch className="bg-text-2" label="text-2" />
              <Swatch className="bg-text-3" label="text-3" />
            </Row>
            <Row label="Semantic">
              <Swatch className="bg-win" label="win" />
              <Swatch className="bg-loss" label="loss" />
              <Swatch className="bg-gold" label="gold" />
            </Row>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-label text-accent border-b border-card-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-sublabel text-text-2">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Swatch({ className, label, dark }: { className: string; label: string; dark?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-12 h-12 rounded-md border border-card-border ${className}`} />
      <span className={`text-mono-xs ${dark ? "text-text-3" : "text-text-2"}`}>{label}</span>
    </div>
  );
}

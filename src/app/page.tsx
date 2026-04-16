export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-heading font-bold text-foreground">
          HackForge
        </h1>
        <p className="text-lg text-muted-foreground">
          Enterprise Hackathon Platform
        </p>
      </main>
    </div>
  );
}

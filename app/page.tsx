import StepWizard from "@/components/StepWizard";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center min-h-screen">
      <header className="pt-10 pb-6 text-center">
        <h1 className="text-5xl font-bold gradient-text tracking-tight">Hummly</h1>
        <p className="mt-2 text-text-secondary text-sm">
          Hum a melody, get a demo
        </p>
      </header>
      <main className="flex-1 w-full max-w-2xl px-4 pb-12">
        <StepWizard />
      </main>
    </div>
  );
}

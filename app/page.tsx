import StepWizard from "@/components/StepWizard";

export default function Home() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#create">Skip to making music</a>
      <StepWizard />
    </div>
  );
}

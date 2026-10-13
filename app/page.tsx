import Link from "next/link";
import StepWizard from "@/components/StepWizard";
import Icon from "@/components/Icon";

export default function Home() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#create">Skip to making music</a>
      <header className="brand-header">
        <Link href="/" className="wordmark" aria-label="Hummly home">
          <span className="brand-mark"><Icon name="wave" /></span>hummly<span className="brand-period">.</span>
        </Link>
        <span className="brand-stamp">Your music playground</span>
      </header>
      <main id="create" className="creation-main"><StepWizard /></main>
    </div>
  );
}

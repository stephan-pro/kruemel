import type { DemoInfo } from "../demo/start";

interface AppProps {
  /** Only set in demo mode (`npm run demo`). */
  readonly demo?: DemoInfo;
}

export function App({ demo }: AppProps) {
  return (
    <main>
      <h1>Putzplan</h1>
      {demo && (
        <p>
          Demo-Modus: {demo.taskCount} Beispielaufgaben und {demo.completionCount} Erledigungen
          liegen im Demo-Speicher dieses Browsers. Echte Daten bleiben unberührt.{" "}
          <a href="?demo=neu">Beispieldaten neu laden</a>
        </p>
      )}
    </main>
  );
}

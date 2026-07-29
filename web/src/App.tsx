import { useEffect, useState } from "react";
import { PassTable } from "./components/PassTable";
import { WalletPass } from "./content/AdminContentProvider";
import { createAdminContentProvider } from "./content/createAdminContentProvider";

export function App() {
  const [passes, setPasses] = useState<WalletPass[]>([]);
  const [status, setStatus] = useState("Loading passes");

  useEffect(() => {
    const contentProvider = createAdminContentProvider();

    contentProvider
      .listPasses()
      .then((loadedPasses) => {
        setPasses(loadedPasses);
        setStatus("");
      })
      .catch(() => {
        setStatus("Start the WalletFun server to load admin data.");
      });
  }, []);

  return (
    <main className="shell">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Mighty Strong LLC</p>
          <h1>WalletFun Admin</h1>
        </div>
      </header>
      {status ? <div className="panel">{status}</div> : <PassTable passes={passes} />}
    </main>
  );
}


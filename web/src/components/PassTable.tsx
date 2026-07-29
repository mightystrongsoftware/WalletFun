import { useEffect, useMemo, useState } from "react";
import { createAdminContentProvider } from "../content/createAdminContentProvider";
import { WalletPass } from "../content/AdminContentProvider";

interface PassTableProps {
  passes: WalletPass[];
}

export function PassTable({ passes }: PassTableProps) {
  const contentProvider = createAdminContentProvider();
  const [message, setMessage] = useState("WalletFun pass updated");
  const [currentPasses, setCurrentPasses] = useState(passes);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(passes[0]?.id ?? null);
  const [firstName, setFirstName] = useState(passes[0]?.firstName ?? "");
  const [lastName, setLastName] = useState(passes[0]?.lastName ?? "");
  const [isPending, setIsPending] = useState(false);
  const selectedPass = useMemo(
    () => currentPasses.find((pass) => pass.id === selectedPassId) ?? null,
    [currentPasses, selectedPassId]
  );

  useEffect(() => {
    setFirstName(selectedPass?.firstName ?? "");
    setLastName(selectedPass?.lastName ?? "");
  }, [selectedPass]);

  async function triggerUpdate() {
    if (!selectedPassId) return;

    setIsPending(true);
    try {
      await contentProvider.createPassUpdate(selectedPassId, message);
      setCurrentPasses(await contentProvider.listPasses());
    } finally {
      setIsPending(false);
    }
  }

  async function saveName() {
    if (!selectedPassId) return;

    setIsPending(true);
    try {
      await contentProvider.updatePassName(selectedPassId, firstName, lastName);
      setCurrentPasses(await contentProvider.listPasses());
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="adminGrid">
      <div className="panel">
        <h2>Pass Updates</h2>
        <label>
          Pass
          <select value={selectedPassId ?? ""} onChange={(event) => setSelectedPassId(event.target.value || null)}>
            {currentPasses.map((pass) => (
              <option key={pass.id} value={pass.id}>
                {pass.firstName} {pass.lastName} - {pass.serialNumber}
              </option>
            ))}
          </select>
        </label>
        <div className="fieldRow">
          <label>
            First name
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </label>
          <label>
            Last name
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
        </div>
        <button
          onClick={saveName}
          disabled={!selectedPassId || isPending || firstName.trim().length === 0 || lastName.trim().length === 0}
        >
          Save Name
        </button>
        <label>
          Message
          <input value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
        <button onClick={triggerUpdate} disabled={!selectedPassId || isPending}>
          Trigger Update
        </button>
      </div>

      <div className="panel tablePanel">
        <h2>Generated Passes</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Serial</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {currentPasses.length === 0 ? (
              <tr>
                <td colSpan={4}>No passes have been generated yet.</td>
              </tr>
            ) : (
              currentPasses.map((pass) => (
                <tr key={pass.id}>
                  <td>{pass.firstName} {pass.lastName}</td>
                  <td>{pass.serialNumber}</td>
                  <td>{pass.status}</td>
                  <td>{new Date(pass.updatedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

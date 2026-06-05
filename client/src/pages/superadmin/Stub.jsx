import { Icon } from "../../components/Icon.jsx";

// Module Phase 2 — page d'attente (la navigation et la route existent déjà).
export default function SaStub({ title, desc }) {
  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">{title}</h1>
          <p className="sa-sub">{desc}</p>
        </div>
      </div>
      <div className="sa-card sa-empty" style={{ padding: "56px 20px" }}>
        <Icon name="clock" style={{ width: 30, height: 30, opacity: .5 }} />
        <div style={{ marginTop: 10, fontWeight: 600 }}>Module en préparation (Phase 2)</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Cette section sera développée prochainement.</div>
      </div>
    </div>
  );
}

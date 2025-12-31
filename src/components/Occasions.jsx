import { useEffect, useState } from "react";
import { fetchOccasions, createOccasion } from "../api/occasionsApi";

export default function Occasions() {
  const [occasions, setOccasions] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchOccasions().then(setOccasions);
  }, []);

  async function handleAdd() {
    if (!name) return;
    const created = await createOccasion({ name });
    setOccasions([...occasions, created]);
    setName("");
  }

  return (
    <div>
      <h3>Occasions</h3>
      <ul>
        {occasions.map(o => (
          <li key={o.id}>{o.name}</li>
        ))}
      </ul>

      <input
        placeholder="New occasion"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <button onClick={handleAdd}>Add</button>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  name: "",
  categoryId: "",
  locationId: "",
  quantity: 1,
  unit: "pcs",
  lowStockAt: 1,
  expiresOn: "",
  notes: "",
};

async function request(url, options) {
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z" /><path d="M8 16c2-3 5-5 9-7" /></>,
    alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5m4-5v5" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function expiryState(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expires = new Date(`${date}T00:00:00`);
  const days = Math.ceil((expires - today) / 86400000);
  if (days < 0) return { label: "Expired", type: "expired" };
  if (days === 0) return { label: "Today", type: "soon" };
  if (days <= 3) return { label: `${days}d left`, type: "soon" };
  return { label: formatDate(date), type: "normal" };
}

export default function App() {
  const dateLabel = new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All items");
  const [modal, setModal] = useState(false);
  const [resourceModal, setResourceModal] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resourceForm, setResourceForm] = useState({ name: "", color: "#dcebd8", icon: "" });

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [itemData, categoryData, locationData, summary] = await Promise.all([
        request("/api/items"),
        request("/api/categories"),
        request("/api/locations"),
        request("/api/dashboard"),
      ]);
      setItems(itemData);
      setCategories(categoryData);
      setLocations(locationData);
      setDashboard(summary);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const canAddItem = categories.length > 0 && locations.length > 0;

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const category = categories.find((entry) => entry.id === item.categoryId);
      const location = locations.find((entry) => entry.id === item.locationId);
      const matchesQuery = !query || [item.name, category?.name, location?.name].some((value) => value?.toLowerCase().includes(query));
      const matchesFilter = filter === "All items"
        || category?.name === filter
        || (filter === "Low stock" && item.quantity <= item.lowStockAt)
        || (filter === "Expiring soon" && expiryState(item.expiresOn)?.type === "soon");
      return matchesQuery && matchesFilter;
    });
  }, [items, categories, locations, search, filter]);

  function openCreate() {
    if (!canAddItem) return;
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id || "", locationId: locations[0]?.id || "" });
    setActionError("");
    setModal(true);
  }

  function openResourceForm(resource) {
    setActionError("");
    setResourceForm({ name: "", color: "#dcebd8", icon: "" });
    setResourceModal(resource);
  }

  async function createResource(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    const isCategory = resourceModal === "categories";
    try {
      const created = await request(`/api/${resourceModal}`, {
        method: "POST",
        body: JSON.stringify(isCategory
          ? { name: resourceForm.name, color: resourceForm.color }
          : { name: resourceForm.name, icon: resourceForm.icon }),
      });
      if (isCategory) setCategories((current) => [...current, created]);
      else setLocations((current) => [...current, created]);
      setResourceModal("");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ ...item });
    setActionError("");
    setModal(true);
  }

  async function saveItem(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    let saved;
    try {
      saved = await request(editing ? `/api/items/${editing.id}` : "/api/items", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ ...form, quantity: Number(form.quantity), lowStockAt: Number(form.lowStockAt) }),
      });
    } catch (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }
    setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
    setModal(false);
    try {
      setDashboard(await request("/api/dashboard"));
    } catch (error) {
      setActionError(`Item saved, but the summary could not refresh: ${error.message}`);
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Remove ${item.name} from your pantry?`)) return;
    setActionError("");
    try {
      await request(`/api/items/${item.id}`, { method: "DELETE" });
    } catch (error) {
      setActionError(error.message);
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      setDashboard(await request("/api/dashboard"));
    } catch (error) {
      setActionError(`Item removed, but the summary could not refresh: ${error.message}`);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ShelfLife home"><span className="brand-mark"><Icon name="leaf" size={21} /></span><span>shelf<span className="brand-light">life</span></span></a>
        <div className="side-caption">YOUR KITCHEN</div>
        <button className="nav-item active"><span className="nav-icon"><Icon name="box" /></span>My pantry<span className="nav-count">{items.length}</span></button>
        <div className="side-caption category-caption">CATEGORIES <button className="tiny-plus" onClick={() => openResourceForm("categories")} aria-label="Add category">+</button></div>
        <div className="category-list">
          {categories.map((category) => <button key={category.id} className={`category-item ${filter === category.name ? "selected" : ""}`} onClick={() => setFilter(filter === category.name ? "All items" : category.name)}><i style={{ background: category.color }} />{category.name}<span>{items.filter((item) => item.categoryId === category.id).length}</span></button>)}
        </div>
        <div className="side-caption location-caption">LOCATIONS <button className="tiny-plus" onClick={() => openResourceForm("locations")} aria-label="Add location">+</button></div>
        <div className="category-list">
          {locations.map((location) => <div key={location.id} className="location-item"><span>{location.icon}</span>{location.name}</div>)}
        </div>
        <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-spark">✳</span><p>A little less waste,<br /><strong>a lot more good.</strong></p><span className="tip-note">You’ve got this.</span></div><div className="profile"><div className="avatar">S</div><div><strong>My kitchen</strong><span>Home pantry</span></div><span className="profile-dots">···</span></div></div>
      </aside>

      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">My kitchen <span>/</span> <strong>Pantry</strong></div><div className="topbar-right"><span className="sync-label"><i /> Everything in its place</span><div className="mini-avatar">S</div></div></header>
        <div className="page-content">
          <section className="welcome">
            <div><div className="eyebrow"><span className="sun-mark">✳</span> {dateLabel}</div><h1>Pantry, in <em>balance.</em></h1><p className="welcome-copy">A little overview of what’s good in your kitchen.</p></div>
            <button className="primary-button" onClick={openCreate} disabled={!canAddItem} title={!canAddItem ? "Add a category and location first" : undefined}><Icon name="plus" size={17} /> Add an item</button>
          </section>

          {loadError ? <div className="error-banner" role="alert"><div><strong>Couldn’t load your pantry.</strong><span>{loadError} Check the connection and try again.</span></div><button className="text-button" onClick={loadData}>Try again</button></div> : <>
            <section className="stats-grid" aria-label="Pantry overview">
              <article className="stat-card"><div className="stat-top"><span>IN YOUR PANTRY</span><span className="stat-icon sage"><Icon name="box" /></span></div><div className="stat-value">{loading ? "—" : dashboard?.totalItems ?? 0}<span> items</span></div><div className="stat-foot">Across {categories.length} lovely categories</div></article>
              <article className="stat-card"><div className="stat-top"><span>RUNNING LOW</span><span className="stat-icon peach"><Icon name="alert" /></span></div><div className="stat-value">{loading ? "—" : dashboard?.lowStock ?? 0}<span> items</span></div><div className="stat-foot">A little nudge for your next shop</div></article>
              <article className="stat-card"><div className="stat-top"><span>USE THESE SOON</span><span className="stat-icon yellow"><Icon name="leaf" /></span></div><div className="stat-value">{loading ? "—" : dashboard?.expiringSoon ?? 0}<span> items</span></div><div className="stat-foot">Freshness is a beautiful thing</div></article>
              <article className="note-card"><span className="note-flower">✳</span><p>Small steps make<br />a <em>fresh</em> difference.</p><span>YOU’RE DOING GREAT</span><div className="note-decoration">✳</div></article>
            </section>

            <section className="inventory-section">
              <div className="section-heading"><div><div className="eyebrow muted-eyebrow">THE GOOD STUFF</div><h2>Your pantry <span>({items.length})</span></h2></div><div className="table-actions"><label className="search-box"><Icon name="search" size={17} /><input aria-label="Search pantry" placeholder="Find something..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="filter-button" onClick={() => setFilter(filter === "Low stock" ? "All items" : "Low stock")} aria-pressed={filter === "Low stock"}><span className="filter-dot" />{filter === "Low stock" ? "Low stock" : "Filter"}<span className="chevron">⌄</span></button></div></div>
              <div className="filter-pills"><button className={`filter-pill ${filter === "All items" ? "chosen" : ""}`} onClick={() => setFilter("All items")}>All items <span>{items.length}</span></button><button className={`filter-pill ${filter === "Low stock" ? "chosen" : ""}`} onClick={() => setFilter("Low stock")}>Running low <span>{dashboard?.lowStock ?? 0}</span></button><button className={`filter-pill ${filter === "Expiring soon" ? "chosen" : ""}`} onClick={() => setFilter("Expiring soon")}>Use soon <span>{dashboard?.expiringSoon ?? 0}</span></button></div>
              {actionError && !modal && <div className="inline-error" role="alert">{actionError}<button onClick={() => setActionError("")} aria-label="Dismiss error"><Icon name="close" size={14} /></button></div>}
              {loading ? <div className="loading-state"><span className="spinner" />Gathering the good stuff...</div> : visibleItems.length === 0 ? <div className="empty-state"><span>✳</span><strong>{items.length ? "Nothing on this shelf just yet." : "Your pantry is ready for a fresh start."}</strong><p>{items.length ? "Try another search or clear your filters." : "Start with your own categories and storage locations."}</p>{!items.length && <div className="empty-actions">{categories.length === 0 && <button className="secondary-button" onClick={() => openResourceForm("categories")}>Add a category</button>}{locations.length === 0 && <button className="secondary-button" onClick={() => openResourceForm("locations")}>Add a location</button>}{canAddItem && <button className="primary-button" onClick={openCreate}><Icon name="plus" size={16} /> Add your first item</button>}</div>}</div> : <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>WHERE</th><th>QUANTITY</th><th>FRESHNESS</th><th aria-label="Actions" /></tr></thead><tbody>
                {visibleItems.map((item, index) => {
                  const category = categories.find((entry) => entry.id === item.categoryId);
                  const location = locations.find((entry) => entry.id === item.locationId);
                  const expiry = expiryState(item.expiresOn);
                  const low = item.quantity <= item.lowStockAt;
                  return <tr key={item.id}>
                    <td><div className={`item-illustration illustration-${index % 6}`}>{category?.name === "Produce" ? "🥑" : category?.name === "Dairy & eggs" ? "🥛" : category?.name === "Drinks" ? "🧃" : "🥖"}</div><div className="item-details"><strong>{item.name}</strong><span><i style={{ background: category?.color }} />{category?.name || "Uncategorized"}</span></div></td>
                    <td><span className="location"><Icon name="pin" size={14} />{location?.name || "Unknown"}</span></td>
                    <td><span className={`quantity ${low ? "quantity-low" : ""}`}>{item.quantity} {item.unit}</span>{low && <span className="low-badge">LOW</span>}</td>
                    <td>{expiry ? <span className={`freshness ${expiry.type}`}>{expiry.type === "soon" ? <span className="fresh-dot" /> : null}{expiry.label}</span> : <span className="freshness no-date">No date set</span>}</td>
                    <td><div className="row-actions"><button onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}><Icon name="edit" size={16} /></button><button onClick={() => deleteItem(item)} aria-label={`Delete ${item.name}`}><Icon name="trash" size={16} /></button></div></td>
                  </tr>;
                })}
              </tbody></table></div>}
              <div className="table-footer"><span>Showing <strong>{visibleItems.length}</strong> of <strong>{items.length}</strong> pantry items</span><span className="footer-fresh">good things grow here <span>✳</span></span></div>
            </section>
            <footer className="page-footer"><span>Made for a more mindful kitchen.</span><span>Less waste, more taste <span>♡</span></span></footer>
          </>}
        </div>
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><div className="eyebrow muted-eyebrow">{editing ? "A SMALL UPDATE" : "ADD TO YOUR KITCHEN"}</div><h2 id="modal-title">{editing ? "Edit pantry item" : "Something good?"}</h2></div><button className="close-button" onClick={() => setModal(false)} aria-label="Close dialog"><Icon name="close" /></button></header><form onSubmit={saveItem}>
        <label className="form-field">Item name<input autoFocus required maxLength={80} placeholder="e.g. Cherry tomatoes" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="form-row"><label className="form-field">Category<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="form-field">Location<select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}>{locations.map((location) => <option key={location.id} value={location.id}>{location.icon} {location.name}</option>)}</select></label></div>
        <div className="form-row"><label className="form-field">Quantity<input required type="number" min="0" step="any" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label className="form-field">Unit<input required maxLength={20} placeholder="pcs, jars..." value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label></div>
        <div className="form-row"><label className="form-field">Let me know when it’s below<input required type="number" min="0" step="any" value={form.lowStockAt} onChange={(event) => setForm({ ...form, lowStockAt: event.target.value })} /></label><label className="form-field">Best before<input type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></label></div>
        <label className="form-field">A little note <span className="optional">(optional)</span><input maxLength={240} placeholder="Anything worth remembering?" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        {actionError && <div className="form-error" role="alert">{actionError}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <><span className="button-spinner" /> Saving...</> : <><Icon name="plus" size={16} /> {editing ? "Save changes" : "Add to pantry"}</>}</button></div>
      </form></section></div>}
      {resourceModal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setResourceModal("")}><section className="modal resource-modal" role="dialog" aria-modal="true" aria-labelledby="resource-title"><header className="modal-header"><div><div className="eyebrow muted-eyebrow">MAKE IT YOURS</div><h2 id="resource-title">Add a {resourceModal === "categories" ? "category" : "location"}</h2></div><button className="close-button" onClick={() => setResourceModal("")} aria-label="Close dialog"><Icon name="close" /></button></header><form onSubmit={createResource}><label className="form-field">Name<input autoFocus required maxLength={40} placeholder={resourceModal === "categories" ? "e.g. Produce" : "e.g. Fridge"} value={resourceForm.name} onChange={(event) => setResourceForm({ ...resourceForm, name: event.target.value })} /></label>{resourceModal === "categories" ? <label className="form-field">Category color<input type="color" value={resourceForm.color} onChange={(event) => setResourceForm({ ...resourceForm, color: event.target.value })} /></label> : <label className="form-field">Icon<input required maxLength={8} placeholder="e.g. ❄️" value={resourceForm.icon} onChange={(event) => setResourceForm({ ...resourceForm, icon: event.target.value })} /></label>}{actionError && <div className="form-error" role="alert">{actionError}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setResourceModal("")}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div></form></section></div>}
    </main>
  );
}

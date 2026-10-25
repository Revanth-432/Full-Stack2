import express from "express";
import { create, find, list, remove, update } from "./store.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use((request, response, next) => {
  const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
  if (request.headers.origin === allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.use(express.json({ limit: "32kb" }));

function hasValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const resourceConfig = {
  items: {
    validate(values) {
      if (typeof values.name !== "string" || !values.name.trim()) return "Name is required.";
      if (!find("categories", values.categoryId)) return "Choose an existing category.";
      if (!find("locations", values.locationId)) return "Choose an existing location.";
      if (!Number.isFinite(values.quantity) || values.quantity < 0) return "Quantity must be zero or more.";
      if (!Number.isFinite(values.lowStockAt) || values.lowStockAt < 0) return "Low-stock threshold must be zero or more.";
      if (typeof values.unit !== "string" || !values.unit.trim()) return "Unit is required.";
      if (values.expiresOn && (typeof values.expiresOn !== "string" || !hasValidDate(values.expiresOn))) return "Use a valid expiry date.";
      return null;
    },
    sanitize(values) {
      return {
        name: values.name.trim(),
        categoryId: values.categoryId,
        locationId: values.locationId,
        quantity: Number(values.quantity),
        unit: values.unit.trim(),
        lowStockAt: Number(values.lowStockAt),
        expiresOn: values.expiresOn || "",
        notes: typeof values.notes === "string" ? values.notes.trim() : "",
      };
    },
  },
  categories: {
    validate(values) {
      if (typeof values.name !== "string" || !values.name.trim()) return "Category name is required.";
      if (typeof values.color !== "string" || !/^#[0-9a-f]{6}$/i.test(values.color)) return "Choose a valid color.";
      return null;
    },
    sanitize(values) {
      return { name: values.name.trim(), color: values.color };
    },
    inUse(id) {
      return list("items").some((item) => item.categoryId === id);
    },
  },
  locations: {
    validate(values) {
      if (typeof values.name !== "string" || !values.name.trim()) return "Location name is required.";
      if (typeof values.icon !== "string" || !values.icon.trim()) return "Location icon is required.";
      return null;
    },
    sanitize(values) {
      return { name: values.name.trim(), icon: values.icon.trim() };
    },
    inUse(id) {
      return list("items").some((item) => item.locationId === id);
    },
  },
};

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/dashboard", (_request, response) => {
  const items = list("items");
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  response.json({
    totalItems: items.length,
    lowStock: items.filter((item) => item.quantity <= item.lowStockAt).length,
    expiringSoon: items.filter((item) => item.expiresOn && item.expiresOn >= today && item.expiresOn <= soon).length,
    categories: list("categories").length,
  });
});

for (const [resource, config] of Object.entries(resourceConfig)) {
  const base = `/api/${resource}`;
  app.get(base, (_request, response) => response.json(list(resource)));
  app.get(`${base}/:id`, (request, response) => {
    const record = find(resource, request.params.id);
    if (!record) return response.status(404).json({ error: `${resource.slice(0, -1)} not found.` });
    response.json(record);
  });
  app.post(base, (request, response) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) return response.status(400).json({ error: "Request body must be a JSON object." });
    const error = config.validate(request.body);
    if (error) return response.status(400).json({ error });
    response.status(201).json(create(resource, config.sanitize(request.body)));
  });
  app.put(`${base}/:id`, (request, response) => {
    if (!find(resource, request.params.id)) return response.status(404).json({ error: `${resource.slice(0, -1)} not found.` });
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) return response.status(400).json({ error: "Request body must be a JSON object." });
    const error = config.validate(request.body);
    if (error) return response.status(400).json({ error });
    response.json(update(resource, request.params.id, config.sanitize(request.body)));
  });
  app.delete(`${base}/:id`, (request, response) => {
    if (!find(resource, request.params.id)) return response.status(404).json({ error: `${resource.slice(0, -1)} not found.` });
    if (config.inUse?.(request.params.id)) return response.status(409).json({ error: `This ${resource.slice(0, -1)} is still assigned to pantry items.` });
    remove(resource, request.params.id);
    response.status(204).end();
  });
}

app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.status === 400 ? "Invalid request body." : "Something went wrong. Please try again." });
});

app.listen(port, () => console.log(`ShelfLife is running on port ${port}`));

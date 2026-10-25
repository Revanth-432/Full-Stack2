import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE || path.join(directory, "data", "inventory.json");

const initialData = {
  categories: [],
  locations: [],
  items: [],
};

function readData() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

let data = readData();

function persist() {
  const temporaryFile = `${dataFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2));
  fs.renameSync(temporaryFile, dataFile);
}

export function list(resource) {
  return data[resource];
}

export function find(resource, id) {
  return data[resource].find((record) => record.id === id);
}

export function create(resource, values) {
  const record = { id: randomUUID(), ...values };
  data[resource].push(record);
  persist();
  return record;
}

export function update(resource, id, values) {
  const index = data[resource].findIndex((record) => record.id === id);
  if (index === -1) return null;
  data[resource][index] = { ...data[resource][index], ...values, id };
  persist();
  return data[resource][index];
}

export function remove(resource, id) {
  const index = data[resource].findIndex((record) => record.id === id);
  if (index === -1) return false;
  data[resource].splice(index, 1);
  persist();
  return true;
}

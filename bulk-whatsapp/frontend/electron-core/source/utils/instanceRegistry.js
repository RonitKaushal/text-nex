/**
 * In-memory instance registry (no MongoDB).
 * Electron / local clients register instances before starting WhatsApp sessions.
 */

class InstanceRegistry {
  constructor() {
    this.registry = new Map();
    this.onUpdateCallback = null;
  }

  setOnUpdate(callback) {
    this.onUpdateCallback = typeof callback === "function" ? callback : null;
  }

  registerInstance(id, data) {
    if (!id) return null;

    const key = id.toString();
    const existing = this.registry.get(key) || {};
    const merged = {
      _id: key,
      ...existing,
      ...data,
      whatsapp: {
        ...(existing.whatsapp || {}),
        ...(data?.whatsapp || {}),
      },
    };

    this.registry.set(key, merged);
    return merged;
  }

  getInstance(id) {
    if (!id) return null;
    return this.registry.get(id.toString()) || null;
  }

  updateInstance(id, updates) {
    const key = id.toString();
    const current = this.registry.get(key) || { _id: key };
    const merged = {
      ...current,
      ...updates,
      whatsapp: updates?.whatsapp
        ? { ...(current.whatsapp || {}), ...updates.whatsapp }
        : current.whatsapp,
    };

    this.registry.set(key, merged);

    if (this.onUpdateCallback) {
      try {
        this.onUpdateCallback(key, merged);
      } catch (e) {
        console.error("[InstanceRegistry] onUpdate error:", e);
      }
    }

    return merged;
  }

  removeInstance(id) {
    this.registry.delete(id.toString());
  }

  listInstances() {
    return Array.from(this.registry.values());
  }

  findByToken(token) {
    if (!token) return null;

    for (const inst of this.registry.values()) {
      if (inst.token === token) return inst;
    }

    return null;
  }

  listByUserId(userId) {
    if (!userId) return [];

    const uid = userId.toString();
    return Array.from(this.registry.values()).filter(
      (inst) => inst.userId?.toString() === uid
    );
  }

  has(id) {
    if (!id) return false;
    return this.registry.has(id.toString());
  }

  clear() {
    this.registry.clear();
  }
}

const instanceRegistry = new InstanceRegistry();

module.exports = instanceRegistry;
module.exports.InstanceRegistry = InstanceRegistry;

if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {
    constructor(bits, name, options = {}) {
      this.name = name || '';
      this.type = options.type || '';
      this.size = 0;
      if (Array.isArray(bits)) {
        for (const b of bits) this.size += b.size ?? b.byteLength ?? 0;
      } else if (bits && typeof bits.size === 'number') this.size = bits.size;
    }
  };
}

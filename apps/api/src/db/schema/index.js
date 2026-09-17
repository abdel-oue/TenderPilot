// Re-export every table group. Drizzle reads this.
// Extensions required: Node ESM does not resolve './user.table'.
export * from './user.table.js';
export * from './tender.table.js';
export * from './document.table.js';
export * from './requirement.table.js';
export * from './analysis.table.js';
export * from './company.table.js';
export * from './usage.table.js';

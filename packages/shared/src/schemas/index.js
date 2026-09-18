// Barrel. Re-export every schema. Both web and api import from here.
// A schema duplicated across the two is a bug.
//
// Relative specifiers carry the .js extension — Node ESM requires it.
export * from './auth.js';
export * from './company.js';
export * from './document.js';
export * from './requirement.js';
export * from './tender.js';
export * from './analysis.js';
export * from './graphState.js';

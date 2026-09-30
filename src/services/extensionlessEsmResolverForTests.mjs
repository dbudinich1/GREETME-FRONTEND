// src/services/extensionlessEsmResolverForTests.mjs
//
// TEST-ONLY infrastructure, not shipped code. draftService.js imports its sibling model with
// `from '../models/greetingDraft'` — no extension. Vite (and every bundler this app ships through)
// resolves that fine, but plain Node ESM (`node --test`) requires a fully-specified relative
// specifier and throws ERR_MODULE_NOT_FOUND on it. That import statement is production code this
// test-writing pass is not allowed to touch, so this is a Node `module.register()` resolver hook
// (see draftServiceMediaFields.test.mjs) that retries a bare extensionless relative specifier with
// `.js` appended, and otherwise gets out of the way. Registered only by that one test file.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}

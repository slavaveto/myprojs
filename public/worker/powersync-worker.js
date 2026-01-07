// Simple wrapper to load PowerSync worker
importScripts('./WASQLiteDB.umd.js');

// Hack to help wa-sqlite find the wasm file in the same directory
// By default it might look in root
self.WA_SQLITE_WASM_PATH = './wa-sqlite-async.wasm'; 
// Some versions check this global or rely on locateFile logic in emscripten

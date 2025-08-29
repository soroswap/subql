// Add `text-encoding` as a dependency and include this code in index.ts before any other imports
import { TextDecoder, TextEncoder } from 'text-encoding';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

//Exports all handler functions
export * from "./mappings/mappingHandlers";



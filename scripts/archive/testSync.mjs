import { syncOCSC } from './dist/services/botService.js';

syncOCSC().then(console.log).catch(console.error);

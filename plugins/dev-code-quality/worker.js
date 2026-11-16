import { parentPort, workerData } from 'node:worker_threads';
import { run } from './core.js';
try { parentPort.postMessage({ok:true,value:run(workerData.request,workerData.limits)}); } catch(error) { parentPort.postMessage({ok:false,error:String(error.message??error)}); }

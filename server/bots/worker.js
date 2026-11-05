'use strict';
const {parentPort}=require('node:worker_threads');const {search}=require('./search');
parentPort.on('message',({id,view,options})=>{try{parentPort.postMessage({id,result:search(view,options)});}catch{parentPort.postMessage({id,error:true});}});

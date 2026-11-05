'use strict';
const contracts=require('./contracts');const heuristic=require('./heuristic');const {knowledge}=require('./information');const {search}=require('./search');const {settings}=require('./config');
function chooseCard(view,options={}){
 const config=settings(options);if(view.legal.length<=1)return view.legal[0];
 if(config.difficulty==='easy'){
  if(config.random()<config.mistakeRate)return view.legal[Math.floor(config.random()*view.legal.length)];
  const limited={...view,played:[]};return heuristic.rankCards(limited,{info:knowledge(limited,{limited:true})})[0].card;
 }
 return config.difficulty==='hard'?search(view,config).card:heuristic.chooseCard(view);
}
function chooseContract(view,options={}){const config=settings(options);if(config.difficulty==='easy'&&config.random()<config.mistakeRate)return {type:view.options[Math.floor(config.random()*view.options.length)],trump:['S','H','D','C'][Math.floor(config.random()*4)]};return contracts.chooseContract(view);}
module.exports={chooseCard,chooseContract,settings};

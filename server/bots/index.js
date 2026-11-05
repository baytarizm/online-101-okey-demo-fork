'use strict';
const contracts=require('./contracts');const heuristic=require('./heuristic');const {search}=require('./search');
function chooseCard(view,options={}){return options.difficulty==='hard'&&view.legal.length>1?search(view,options).card:heuristic.chooseCard(view);}
module.exports={chooseCard,chooseContract:contracts.chooseContract};

'use strict';
const contracts=require('./contracts');const heuristic=require('./heuristic');
module.exports={chooseCard:heuristic.chooseCard,chooseContract:contracts.chooseContract};

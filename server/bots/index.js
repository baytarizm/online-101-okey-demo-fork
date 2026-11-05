'use strict';
const legacy=require('./legacy');const heuristic=require('./heuristic');
module.exports={chooseCard:heuristic.chooseCard,chooseContract:legacy.chooseContract};

'use strict';
const legacy=require('./legacy');
// Stage 1 intentionally preserves policy while introducing the public-only decision boundary.
module.exports={chooseCard:legacy.chooseCard,chooseContract:legacy.chooseContract};

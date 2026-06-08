const fs = require('fs');
const path = require('path');
const data = require('./app/api/researcher/local-data.json');
const compounds = data.compounds || [];

const stacks = compounds.filter(c => c.is_stack);
console.log("Stacks:");
stacks.forEach(s => console.log(s.display_name));

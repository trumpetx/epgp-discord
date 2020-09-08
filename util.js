const _ = require('lodash');

module.exports.sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.startsWithIgnoreCase = (str, startsWith) => {
  let substr = str.substring(0, startsWith.length);
  return substr.toLowerCase() === startsWith.toLowerCase();
};

//
// Items shared between bot & web
//

module.exports.isCEPGP = memberArray => {
  return memberArray.length === 6;
};

function calcPr(entry) {
  return (_.toNumber(entry[1]) / _.toNumber(entry[2])).toFixed(2);
}

module.exports.rosterToTabList = (roster, tabWidth = 2) => {
  let maxName = 8;
  let maxEP = 5;
  let maxGP = 5;
  roster = roster
    .map(arr => {
      if (module.exports.isCEPGP(arr)) {
        return [arr[0], arr[3], arr[4]];
      } else {
        return arr;
      }
    })
    .sort((e1, e2) => calcPr(e2) - calcPr(e1))
    .map(entry => {
      let name = entry[0];
      const idx = name.lastIndexOf('-');
      if (idx !== -1) {
        name = name.substring(0, idx);
      }
      maxName = Math.max(maxName, name.length);
      maxEP = Math.max(maxEP, _.toInteger(entry[1]).toString().length);
      maxGP = Math.max(maxGP, _.toInteger(entry[2]).toString().length);
      return [name, entry[1], entry[2]];
    })
    .map(entry => {
      let name = entry[0].padEnd(maxName + tabWidth, ' ');
      const ep = ('' + entry[1]).padEnd(maxEP + tabWidth, ' ');
      const gp = ('' + entry[2]).padEnd(maxGP + tabWidth, ' ');
      const pr = calcPr(entry);
      if (pr > 0) {
        return `${name}${ep}${gp}${pr}`;
      }
      return undefined;
    })
    .filter(_.isString);
  const chunkHeader = '```\n' + 'Name'.padEnd(maxName + tabWidth) + 'EP'.padEnd(maxEP + tabWidth) + 'GP'.padEnd(maxGP + tabWidth) + 'PR\n';
  return {
    roster,
    chunkHeader,
    chunkFooter: '```'
  };
};

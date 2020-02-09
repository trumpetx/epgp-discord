module.exports.sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.startsWithIgnoreCase = (str, startsWith) => {
  let substr = str.substring(0, startsWith.length);
  return substr.toLowerCase() === startsWith.toLowerCase();
};

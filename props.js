const fs = require('fs');

// Save this JSON structure to props.json wherever the 'current' launch directory is (aka, where db.json is saved)
const props = {
  clientId: undefined,
  port: 8080
};

const propsPath = ['props.json'].find(fs.existsSync);
if (propsPath) {
  Object.assign(props, JSON.parse(fs.readFileSync(propsPath, 'UTF-8')));
}

let extPortString = ':' + (props.extPort || props.port || 8080);
if (extPortString === ':80') {
  extPortString = '';
}
props.extPortString = extPortString;
module.exports.props = props;

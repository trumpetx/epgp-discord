const fs = require('fs');

// Save this JSON structure to props.json wherever the 'current' launch directory is (aka, where db.json is saved)
const props = {
  clientId: undefined,
  token: undefined,
  prefix: '!epgp',
  botPermissions: 93184,
  port: 8080
};

const propsPath = ['props.json'].find(fs.existsSync);
if (propsPath) {
  Object.assign(props, JSON.parse(fs.readFileSync(propsPath, 'UTF-8')));
}

module.exports.props = props;

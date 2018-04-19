const debug = require('debug')('masked-numbers');
const path = require('path');

module.exports.serveHtml = (req, res) => {
  debug('sending html');
  const filePath = path.join(__dirname, './../views/index.html');
  debug(filePath);
  res.sendFile(filePath);
}
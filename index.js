/* Import our Modules */
const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const ringing = 'https://s3.amazonaws.com/bw-demo/ring.mp3';
const forwardTo = require('./fowardConfigs.json');

/* Express Setup */
let app  = express();
let http = require('http').Server(app);
app.use(bodyParser.json());
app.set('port', (process.env.PORT || 3000));

function startServer() {
  debug('Starting Server');
  app.use(favicon(path.join(__dirname, 'views', 'favicon.ico')))
  app.use(bodyParser.json());
  app.set('models', require('./models'));
  app.use('/', require('./routes/view_routes.js'));
  app.use('/bandwidth', require('./routes/bandwidth_routes.js'));
  app.use('/v1/bindings', require('./routes/bindings_routes.js'));
  const viewPath = path.join(__dirname, 'views');
  app.get(/^(.+)$/, function(req, res) { res.sendFile(viewPath + req.params[0]); });
  /// catch 404 and forward to error handler
  app.use( (req, res, next) => {
    //debug(req)
    debug(req.body)
    debug(req.url)
    var err = new Error('not found');
    err.status = 404;
    res.sendStatus(404, 'Not Found')
  });

  // production error handler, no stacktraces leaked to user
  app.use( (err, req, res, next) => {
    res.status(err.status || 500);
    debug(err);
    if (typeof(err.status) === 'undefined') {
      res.send({
        status: 'error',
        error: 'service error'
      });
    } else {
      res.send({
        status: 'error',
        error: err.message
      });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, process.env.HOST || "0.0.0.0", function () {
    console.log('Masked Numbers listening on port ' + port);
  });
}

/******************************************************************************
 * Migrate and sync Database
 * Set up server on configured port
 *****************************************************************************/
db.sequelize.sync().then(startServer);

module.exports = app;